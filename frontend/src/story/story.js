import '../style.css'

// scroll-reveal
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target) } })
}, { threshold: 0.15 })
document.querySelectorAll('.reveal').forEach((el) => io.observe(el))

// smooth anchor scroll
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (ev) => {
    const id = a.getAttribute('href')
    if (id.length > 1) { ev.preventDefault(); document.querySelector(id)?.scrollIntoView({ behavior: 'smooth' }) }
  })
})
