const ENGLISH_GUIDE_ID = 'YOUR-ENGLISH-GUIDE-ID';
const MANDARIN_GUIDE_ID = '2c330224-d498-42de-85fa-27750449c3f4';
const ARABIC_GUIDE_ID = 'YOUR-ARABIC-GUIDE-ID';
const VIETNAMESE_GUIDE_ID = 'YOUR-VIETNAMESE-GUIDE_ID';
const DEFAULT_GUIDE_ID = '2c330224-d498-42de-85fa-27750449c3f4';

document.addEventListener('DOMContentLoaded', () => {
      const chatBtn = document.getElementById('chatBtn');
      const englishBtn = document.getElementById('englishBtn');
      const mandarinBtn = document.getElementById('mandarinBtn');
      const arabicBtn = document.getElementById('arabicBtn');
      const vietnameseBtn = document.getElementById('vietnameseBtn');
      const callbackBtn = document.getElementById('callbackBtn');
      const videoCallBtn = document.getElementById('videoCallBtn');

      englishBtn.addEventListener('click', () => {
        englishBtn.dataset.originalText = englishBtn.textContent;
        launchCXoneChat(ENGLISH_GUIDE_ID, "Hello, I need support.", englishBtn);
      });

      mandarinBtn.addEventListener('click', () => {
        mandarinBtn.dataset.originalText = mandarinBtn.textContent;
        launchCXoneChat(MANDARIN_GUIDE_ID, "您好，我需要支持。 (Hello, I need support.)", mandarinBtn);
      });

      arabicBtn.addEventListener('click', () => {
        arabicBtn.dataset.originalText = arabicBtn.textContent;
        launchCXoneChat(ARABIC_GUIDE_ID, "مرحبًا، أحتاج إلى دعم.", arabicBtn);
      });

      vietnameseBtn.addEventListener('click', () => {
        vietnameseBtn.dataset.originalText = vietnameseBtn.textContent;
        launchCXoneChat(VIETNAMESE_GUIDE_ID, "Xin chào, tôi cần hỗ trợ.", vietnameseBtn);
      });

      chatBtn.addEventListener('click', () => {
        chatBtn.dataset.originalText = chatBtn.textContent;
        launchCXoneChat(DEFAULT_GUIDE_ID, "Hello, I need help.", chatBtn);
      });

      callbackBtn.addEventListener('click', () => {
        const phone = prompt("Please enter your phone number for a callback:");
        if (phone && /^\+?\d{8,15}$/.test(phone)) {
          sendCallbackRequest(phone);
        } else {
          alert("Please enter a valid phone number (8-15 digits).");
        }
      });

      videoCallBtn.addEventListener('click', () => {
        videoCallBtn.dataset.originalText = videoCallBtn.textContent;
        const surflyUrl = videoCallBtn.dataset.surflyUrl;
        sendVideoCallRequest(surflyUrl, videoCallBtn);
      });

      function launchCXoneChat(guideId, messageText, buttonElement) {
        if (buttonElement) {
          buttonElement.disabled = true;
          buttonElement.textContent = 'Loading Chat...';
        }

        const n = 'cxone';
        const u = 'https://web-modules-de-na1.niceincontact.com/loader/1/loader.js';
        window.CXoneDfo = n;
        window[n] = window[n] || function () {
          (window[n].q = window[n].q || []).push(arguments);
        };
        window[n].u = u;

        const existingScript = document.querySelector(`script[src*="loader.js"]`);
        if (!existingScript) {
          const script = document.createElement("script");
          script.type = "module";
          script.src = u + "?" + Math.round(Date.now() / 1e3 / 3600);
          script.onload = function () {
            window[n]('init', '1092');
            window[n]('guide', 'init', guideId);
            window[n]('guide', 'setWidgetSize', '500px', '700px');
            setTimeout(() => {
              window[n]('guide', 'sendMessage', messageText);
              if (buttonElement) {
                buttonElement.disabled = false;
                buttonElement.textContent = buttonElement.dataset.originalText;
              }
            }, 500);
          };
          script.onerror = function() {
            if (buttonElement) {
              buttonElement.disabled = false;
              buttonElement.textContent = buttonElement.dataset.originalText;
              alert('Failed to load chat. Please try again.');
            }
          };
          document.head.appendChild(script);
        } else {
          window[n]('guide', 'init', guideId);
          window[n]('guide', 'sendMessage', messageText);
          if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = buttonElement.dataset.originalText;
          }
        }
      }

      function sendCallbackRequest(phoneNumber) {
        fetch('/api/callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phoneNumber })
        })
        .then(response => {
          if (response.ok) {
            alert("Your callback request has been submitted. We will call you shortly.");
          } else {
            alert(`Failed to request callback. Status: ${response.status} - ${response.statusText}. Please try again later.`);
          }
        })
        .catch(error => {
          console.error("Callback error:", error);
          alert("There was an error sending your callback request.");
        });
      }

      function sendVideoCallRequest(surflyUrl, buttonElement) {
        if (buttonElement) {
          buttonElement.disabled = true;
          buttonElement.textContent = 'Requesting Video Call...';
        }

        fetch('/api/video-callback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ surflyUrl })
        })
        .then(response => {
          if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = buttonElement.dataset.originalText;
          }
          if (response.ok) {
            alert("Video Call request submitted successfully. An agent will contact you shortly.");
          } else {
            alert(`Failed to submit video call request. Status: ${response.status} - ${response.statusText}. Please try again later.`);
          }
        })
        .catch(error => {
          if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = buttonElement.dataset.originalText;
          }
          console.error("Video Call error:", error);
          alert("There was an error sending your video call request.");
        });
      }

    });

    // Automatically launch chat on page load
    launchCXoneChat(DEFAULT_GUIDE_ID, "Hello, I need help.", null);
