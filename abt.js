const slides = document.querySelectorAll('.slidex');
let index = 0;

function showSlide() {
  slides.forEach((slide, i) => {
    slide.classList.remove('active');
    if (i === index) {
      slide.classList.add('active');
    }
  });

  index = (index + 1) % slides.length;
}

showSlide(); 
setInterval(showSlide, 4000); 

document.addEventListener('DOMContentLoaded', function () {
    const carouselElement = document.querySelector('#carouselExampleSlidesOnly');
  
    if (carouselElement) {
      const carousel = new bootstrap.Carousel(carouselElement, {
        interval: 3000, 
        ride: 'carousel'
      });
    }
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

document.getElementById('contact-form').addEventListener('submit', function (e) {
  e.preventDefault(); 

  const form = e.target;
  const data = new FormData(form);

  fetch(form.action, {
    method: 'POST',
    body: data,
    headers: {
      'Accept': 'application/json'
    }
  }).then(response => {
    if (response.ok) {
      showPopup();
      form.reset(); 
    } else {
      alert("There was a problem sending the message.");
    }
  }).catch(error => {
    alert("An error occurred.");
    console.error(error);
  });
});

function showPopup() {
  const popup = document.getElementById('popup');
  popup.style.display = 'block';

  setTimeout(() => {
    popup.style.display = 'none';
  }, 3000);
}
