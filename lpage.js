const boxes = document.querySelectorAll(".box");
const nextBtn = document.querySelector(".next");
const prevBtn = document.querySelector(".previous");

if (boxes.length && nextBtn && prevBtn) {
  let currentPage = 0;
  let boxesPerPage = getBoxesPerPage();

  function getBoxesPerPage() {
    const width = window.innerWidth;
    if (width <= 600) return 1;
    if (width <= 898) return 2;
    if (width <= 1200) return 3;
    return 4;
  }

  function updateView() {
    boxes.forEach((box) => {
      box.style.display = "none";
    });

    const start = currentPage * boxesPerPage;
    const end = start + boxesPerPage;

    boxes.forEach((box, index) => {
      if (index >= start && index < end) {
        box.style.display = "block";
      }
    });

    prevBtn.style.display = currentPage === 0 ? "none" : "block";


    if (end >= boxes.length) {
      nextBtn.style.display = "none";
    } else {
      nextBtn.style.display = "block";
    }
  }

  nextBtn.addEventListener("click", function () {
    if ((currentPage + 1) * boxesPerPage < boxes.length) {
      currentPage++;
      updateView();
    }
  });

  prevBtn.addEventListener("click", function () {
    if (currentPage > 0) {
      currentPage--;
      updateView();
    }
  });

  

  updateView(); 
}
  const slides = document.querySelectorAll('.slide');
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






