const equipment=['⚽','🏐','🏀','🎮'];
document.querySelectorAll('.sports-grid .sport-icon').forEach((icon,index)=>{icon.classList.add('equipment');icon.textContent=equipment[index]||'•';});
