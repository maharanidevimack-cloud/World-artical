// ==========================================
// 2. AUDIO READER & MODAL MANAGER
// ==========================================
let isAudioPlaying = false;
let globalUtterance = null;
let currentAudioLang = 'en';

// Initialize speech synthesis voices
function initAudioEngine() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }
}

function toggleGlobalAudio(lang) {
  if (!('speechSynthesis' in window)) {
    alert("Audio speech is not supported in your browser.");
    return;
  }

  const playBtnSvg = document.getElementById('playIconSvg');
  const statusText = document.getElementById('audioStatusText');
  currentAudioLang = lang;

  if (isAudioPlaying) {
    window.speechSynthesis.cancel();
    isAudioPlaying = false;
    resetAudioUI();
    return;
  }

  const title = document.getElementById('articleTitle').innerText;
  const desc = document.getElementById('articleDescription').innerText;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = document.getElementById('articleBody').innerHTML;
  
  const cleanBodyText = tempDiv.textContent || tempDiv.innerText || "";
  const fullText = `${title}. ${desc}. ${cleanBodyText}`.substring(0, 3000);

  if (!fullText.trim()) {
    alert("No text available to read.");
    return;
  }

  window.speechSynthesis.cancel();

  globalUtterance = new SpeechSynthesisUtterance(fullText);
  globalUtterance.lang = currentAudioLang === 'hi' ? 'hi-IN' : 'en-US';
  globalUtterance.rate = 1.0;

  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.lang.includes(globalUtterance.lang) && (v.name.includes('Female') || v.name.includes('Google') || v.name.includes('Natural') || v.name.includes('Zira')));
  if (selectedVoice) {
    globalUtterance.voice = selectedVoice;
  }

  globalUtterance.onstart = () => {
    isAudioPlaying = true;
    playBtnSvg.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/>`;
    statusText.innerText = "Playing audio...";
  };

  globalUtterance.onend = () => {
    isAudioPlaying = false;
    resetAudioUI();
  };

  globalUtterance.onerror = () => {
    isAudioPlaying = false;
    resetAudioUI();
  };

  setTimeout(() => {
    window.speechSynthesis.speak(globalUtterance);
  }, 100);
}

function resetAudioUI() {
  const playBtnSvg = document.getElementById('playIconSvg');
  const statusText = document.getElementById('audioStatusText');
  if (playBtnSvg && statusText) {
    playBtnSvg.innerHTML = `
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/>
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
    `;
    statusText.innerText = "Play full article audio";
  }
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    isAudioPlaying = false;
    resetAudioUI();
  }
}

function askGemini() {
  const title = document.getElementById('articleTitle').innerText;
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = document.getElementById('articleBody').innerHTML;
  const cleanText = tempDiv.textContent || tempDiv.innerText || "";
  const queryText = `Please explain and summarize this Wikipedia article:\n\nTitle: ${title}\n\n${cleanText.substring(0, 3500)}`;
  window.open(`https://gemini.google.com/app?q=${encodeURIComponent(queryText)}`, '_blank');
}

function openImageModal(imgSrc) {
  const modal = document.getElementById('imageModal');
  document.getElementById('modalImage').src = imgSrc;
  modal.classList.remove('hidden');
}

function closeImageModal() {
  document.getElementById('imageModal').classList.add('hidden');
}
