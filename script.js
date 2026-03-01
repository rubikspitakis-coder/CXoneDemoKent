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
              window[n]('chat', 'sendMessage', messageText);
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
          window[n]('chat', 'sendMessage', messageText);
          if (buttonElement) {
            buttonElement.disabled = false;
            buttonElement.textContent = buttonElement.dataset.originalText;
          }
        }
      }

      function sendCallbackRequest(phoneNumber) {
  fetch(`https://api-b32.nice-incontact.com/incontactapi/services/v32.0/queuecallback?phoneNumber=%2B61416012160&callerId=%2B61385610000&skill=25174628`, {
    method: 'POST',
    headers: {
      'Accept': '*/*',
      'Authorization': `Bearer YOUR_PLACEHOLDER_JWT_TOKEN`
    }
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

        fetch('https://api-b32.nice-incontact.com/incontactapi/services/v32.0/interactions/work-items?pointOfContact=53858778', {
          method: 'POST',
          headers: {
            'Accept': 'application/json',
            'Authorization': 'Bearer eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6ImN4b25lLWF0cy0yMjAxMDEtdWgifQ.eyJyb2xlIjp7ImxlZ2FjeUlkIjoiQWRtaW5pc3RyYXRvciIsImlkIjoiMTFlODQ3M2EtODIxZS1jNTEwLTgwMzItMDI0MmFjMTEwMDA1IiwibGFzdFVwZGF0ZVRpbWUiOjE3NTMyMDYyMDMwMDAsInNlY29uZGFyeVJvbGVzIjpbXX0sInZpZXdzIjp7fSwiaWNTUElkIjoiNTgiLCJpY0FnZW50SWQiOiI2ODk1MjA0Iiwic3ViIjoidXNlcjoxMWU5Mzg4Ny0zNjVkLTg1ZjAtYWZlMy0wMjQyYWMxMTAwMDIiLCJpc3MiOiJodHRwczovL2F1dGgubmljZS1pbmNvbnRhY3QuY29tIiwiZ2l2ZW5fbmFtZSI6IlRpbSIsImF1ZCI6IjUzZDkxMmQzLWI3ZDAtNGQ4NS1iOWYyLTQ3ZWQwNzc5ZmEwYUBjeG9uZSIsImljQlVJZCI6NDU5NzM1OSwibmFtZSI6InRpbWhAYjMyLmNjb20iLCJ0ZW5hbnRJZCI6IjExZTg0NzNhLTdmYTYtZTc0MC04NzgzLTAyNDJhYzExMDAwNiIsImZhbWlseV9uYW1lIjoiSHVnZ2lucyIsImlhdCI6MTc1MzY3MzU3MywiZXhwIjoxNzUzNjc3MTczfQ.WBCJ6DaX0JqGojPXoENvUe6jhYVWEhfNgogo3cfXAtdmRaqtDWe25od5awniTrRUW7BBXcLIzCUgpsikQWmot09DxhKJUmq_sfJVYxJC1QpLSz1B2jYcdebBFFysBu_3Tl8OaMtWxDCvPmNh_R7VWSVgtvAvJ66QbuIPLriuMGI',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            "notes": `Surfly Video Call Requested: ${surflyUrl}`,
            "mediaType": "WorkItem"
          })
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