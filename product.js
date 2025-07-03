document.addEventListener('DOMContentLoaded', function () {
    const categoryLinks = document.querySelectorAll('#category-list a');
    const products = document.querySelectorAll('.product-card');

    // 🔹 Filter products by category (if exists)
    if (categoryLinks.length > 0) {
        categoryLinks.forEach(link => {
            link.addEventListener('click', function (e) {
                e.preventDefault();
                const category = link.getAttribute('data-category');
                products.forEach(product => {
                    product.style.display =
                        category === 'all' || product.getAttribute('data-category') === category
                            ? 'block'
                            : 'none';
                });
            });
        });
    }
});

// Assuming you have a form with the id "myForm"
const form = document.getElementById('myForm');
form.addEventListener('submit', (event) => {
    event.preventDefault();  // Prevent the default form submission

    const formData = new FormData(form);
    const data = {};
    formData.forEach((value, key) => {
        data[key] = value;
    });

    fetch('http://localhost:3000/submit-form', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
    })
    .then(response => response.json())
    .then(data => {
        console.log('Success:', data);
        alert(data.message);  // Show success message to user
    })
    .catch(error => {
        console.error('Error:', error);
    });
});




/* monggodb na nadelete 
[
  {
    "_id": 1,
    "category": "aquarium-tanks",
    "image": "images/aquarium tank.webp",
    "alt": "Ultra Clear Aquarium",
    "title": "Ultra Clear Aquarium 60x40x40cm",
    "price": 3720
  },
  {
    "_id": 2,
    "category": "aquarium-lights",
    "image": "images/ledstar.png",
    "alt": "Ledstar C 40",
    "title": "Ledstar C 40 Light",
    "price": 3450
  },
  {
    "_id": 3,
    "category": "filters",
    "image": "images/hepofilter.jpg",
    "alt": "Hepo 018 Filter",
    "title": "Hepo 018 Filter",
    "price": 370
  },
  {
    "_id": 4,
    "category": "driftwoods-stones",
    "image": "images/dragonstone.jpg",
    "alt": "Dragon Stone",
    "title": "Dragon Stone",
    "price": 150,
    "price_unit": "kg"
  },
  {
    "_id": 5,
    "category": "soil-sand-media",
    "image": "images/ecosoil.jpg",
    "alt": "TCFM Ecosoil",
    "title": "TCFM Ecosoil 8L",
    "price": 1200
  },
  {
    "_id": 6,
    "category": "accessories",
    "image": "images/tools.jpg",
    "alt": "Aquascaping Tools",
    "title": "Aquascaping Tools",
    "price": null
  },
  {
    "_id": 11,
    "category": "aquarium-lights",
    "image": "images/ledstar-d-60.webp",
    "alt": "Ledstar D 60",
    "title": "Ledstar D 60 Light",
    "price": 6750
  },
  {
    "_id": 13,
    "category": "filters",
    "image": "images/sunsun-hw-602b.jpg",
    "alt": "Sunsun HW 602B",
    "title": "Sunsun HW 602B (5 gallons)",
    "price": 1300
  },
  {
    "_id": 7,
    "category": "driftwoods-stones",
    "image": "images/seiryuuu stone.jpg",
    "alt": "Seiryu Stone",
    "title": "Seiryu Stone",
    "price": 150,
    "price_unit": "kg"
  },
  {
    "_id": 8,
    "category": "driftwoods-stones",
    "image": "images/black seiryu stone.jpg",
    "alt": "Black Seiryu Stone",
    "title": "Seiryu Stone",
    "price": 150,
    "price_unit": "kg"
  },
  {
    "_id": 9,
    "category": "driftwoods-stones",
    "image": "images/slatestone.jpg",
    "alt": "Slate Stone",
    "title": "Seiryu Stone",
    "price": 150,
    "price_unit": "kg"
  },
  {
    "_id": 10,
    "category": "aquarium-lights",
    "image": "images/ledstar-j-60.png",
    "alt": "Ledstar J 60",
    "title": "LedStar Model J 60 Stone",
    "price": 9350
  },
  {
    "_id": 12,
    "category": "filters",
    "image": "images/stainlesscanisterfilter.jpg",
    "alt": "Stainless Canister Filter",
    "title": "Stainless Canister Filter (TCFM pump) SCF 208 (10L | 10-25g)",
    "price": 4000
  },
  {
    "_id": 14,
    "category": "filters",
    "image": "images/shriuba-pf-60.png",
    "alt": "Shiruba PF 60",
    "title": "Stainless Canister Filter (TCFM pump) SCF 208 (10L | 10-25g)",
    "price": 473
  },
  {
    "_id": 15,
    "category": "aquarium-lights",
    "image": "images/ledstar-nano.jpg",
    "alt": "Ledstar Nano series (app controlled, 30cm)",
    "title": "Ledstar Nano series ( app controlled, 30cm)",
    "price": 3650
  },
  {
    "_id": 16,
    "category": "soil-sand-media",
    "image": "images/whitesand.jpg",
    "alt": "White Sand",
    "title": "White Sand",
    "price": 60,
    "price_unit": "kg"
  },
  {
    "_id": 17,
    "category": "soil-sand-media",
    "image": "images/blacksand.jpg",
    "alt": "Black Sand",
    "title": "White Sand",
    "price": 60,
    "price_unit": "kg"
  },
  {
    "_id": 18,
    "category": "fishes",
    "image": "images/greendanio.jpg",
    "alt": "Green Danio",
    "title": "Green Danio",
    "price": null
  },
  {
    "_id": 19,
    "category": "fishes",
    "image": "images/bronzecorydora.jpg",
    "alt": "Bronze Corydora",
    "title": "Bronze Corydora",
    "price": null
  }
]
*/
