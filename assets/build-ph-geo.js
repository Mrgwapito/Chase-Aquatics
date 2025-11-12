// assets/build-ph-geo.js
// Build a full PH regions → provinces → cities/municipalities → barangays JSON
// Output: assets/ph-geo.json
// No ESM / node-fetch required (uses https). Works on Node 16+.

const fs = require('fs');
const path = require('path');
const https = require('https');

const BASE = 'https://psgc.gitlab.io/api';

function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`${res.statusCode} ${res.statusMessage} for ${url}`));
          res.resume();
          return;
        }
        let raw = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            const parsed = JSON.parse(raw);
            resolve(parsed);
          } catch (e) {
            reject(new Error(`Invalid JSON from ${url}: ${e.message}`));
          }
        });
      })
      .on('error', (err) => reject(err));
  });
}

(async () => {
  try {
    console.log('ℹ️  Fetching Regions…');
    const regions = await fetchJSON(`${BASE}/regions/`);

    console.log('ℹ️  Fetching Provinces…');
    const provinces = await fetchJSON(`${BASE}/provinces/`);

    console.log('ℹ️  Fetching Cities & Municipalities…');
    const citiesMunis = await fetchJSON(`${BASE}/cities-municipalities/`);

    console.log('ℹ️  Fetching Barangays… (this is the big list)');
    const barangays = await fetchJSON(`${BASE}/barangays/`);

    // Index helpers
    const provByRegion = new Map(); // regionCode -> [prov]
    provinces.forEach((p) => {
      const list = provByRegion.get(p.regionCode) || [];
      list.push(p);
      provByRegion.set(p.regionCode, list);
    });

    const citiesByProvince = new Map(); // provinceCode -> [city/muni]
    const citiesByRegion = new Map();   // regionCode -> [city/muni] (for NCR & prov-less)
    citiesMunis.forEach((c) => {
      if (c.provinceCode) {
        const list = citiesByProvince.get(c.provinceCode) || [];
        list.push(c);
        citiesByProvince.set(c.provinceCode, list);
      }
      // always keep a region-level bucket too (NCR special handling)
      const rlist = citiesByRegion.get(c.regionCode) || [];
      rlist.push(c);
      citiesByRegion.set(c.regionCode, rlist);
    });

    const brgysByCityOrMuni = new Map(); // code -> [barangays]
    barangays.forEach((b) => {
      // Barangays can reference cityCode *or* municipalityCode (PSGC uses either depending on LGU type)
      const code = b.cityCode || b.municipalityCode;
      if (!code) return;
      const list = brgysByCityOrMuni.get(code) || [];
      list.push(b);
      brgysByCityOrMuni.set(code, list);
    });

    // Build final tree
    const out = { regions: [] };

    for (const r of regions) {
      const regionNode = {
        code: r.code,
        name: r.name,
        provinces: []
      };

      // NCR (13…) has no provinces in PSGC. We synthesize one "Metro Manila".
      const isNCR = r.code === '130000000';

      if (isNCR) {
        const mmCities = citiesByRegion.get(r.code) || [];
        const provinceNode = {
          name: 'Metro Manila',
          cities: []
        };

        for (const city of mmCities) {
          const brgys = brgysByCityOrMuni.get(city.code) || [];
          provinceNode.cities.push({
            name: city.name,
            zip: '', // PSGC API has no ZIPs
            barangays: brgys.map((b) => b.name)
          });
        }

        regionNode.provinces.push(provinceNode);
      } else {
        const theseProvs = provByRegion.get(r.code) || [];
        for (const p of theseProvs) {
          const cityList = citiesByProvince.get(p.code) || [];
          const provNode = {
            name: p.name,
            cities: []
          };

          for (const city of cityList) {
            const brgys = brgysByCityOrMuni.get(city.code) || [];
            provNode.cities.push({
              name: city.name,
              zip: '', // PSGC has no ZIP; you can enrich later from PhilPost
              barangays: brgys.map((b) => b.name)
            });
          }

          regionNode.provinces.push(provNode);
        }
      }

      out.regions.push(regionNode);
    }

    const outPath = path.join(__dirname, 'ph-geo.json');
    fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

    console.log(`✅ Built: ${outPath}`);
    console.log(`ℹ️  Regions: ${out.regions.length}`);
    console.log('ℹ️  Note: ZIP codes are left empty (PSGC does not contain ZIP).');
  } catch (err) {
    console.error('❌ Build failed:', err.message);
    process.exit(1);
  }
})();
