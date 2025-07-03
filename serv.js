const buttons = document.querySelectorAll('.fil-btn');
const photos = document.querySelectorAll('.photo');

  buttons.forEach(btn => {
    btn.addEventListener('click', () => {

      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const filter = btn.dataset.filter;

      photos.forEach(photo => {
        const category = photo.dataset.category;
        if (filter === 'all' || category === filter) {
          photo.classList.remove('hide');
        } else {
          photo.classList.add('hide');
        }
      });
    });
  });

const navbar = document.querySelector('.navbar');
const placeholder = document.querySelector('.navbar-placeholder');
const navbarHeight = navbar.offsetHeight;

window.addEventListener('scroll', () => {
    if (window.scrollY >= navbarHeight) {
        navbar.classList.add('fixed');
    } else {
        navbar.classList.remove('fixed');
    }
});

