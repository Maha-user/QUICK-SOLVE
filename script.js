const historyKey = 'math-ai-tutor-history-v1';
const chatWindow = document.querySelector('.message-window');
const inputField = document.querySelector('.chat-input');
const sendBtn = document.querySelector('.send-btn');
const newChatBtn = document.querySelector('.new-chat-btn');
const themeToggle = document.querySelector('#theme-toggle');
const suggestions = document.querySelectorAll('.tag');
const cameraBtn = document.querySelector('#camera-btn');
const galleryBtn = document.querySelector('#gallery-btn');
const micBtn = document.querySelector('#mic-btn');
const imageInput = document.querySelector('#image-input');
const imagePreview = document.querySelector('#image-preview');
const previewImg = document.querySelector('#preview-img');

let isRecording = false;
let mediaRecorder = null;
let recognition = null;
let currentImageData = null;

const chatState = {
  messages: [],
  historySessions: []
};

// Initialize speech recognition
if (window.SpeechRecognition || window.webkitSpeechRecognition) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => {
    micBtn.classList.add('recording');
    micBtn.textContent = '🔴';
  };

  recognition.onend = () => {
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎤';
    isRecording = false;
  };

  recognition.onresult = (event) => {
    const transcript = Array.from(event.results)
      .map(result => result[0].transcript)
      .join('');
    inputField.value = transcript;
    inputField.focus();
  };
}

// Camera access
cameraBtn.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video = document.createElement('video');
    video.srcObject = stream;
    video.play();

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    setTimeout(() => {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      ctx.drawImage(video, 0, 0);
      currentImageData = canvas.toDataURL('image/jpeg');
      previewImg.src = currentImageData;
      imagePreview.style.display = 'block';
      stream.getTracks().forEach(track => track.stop());
      inputField.placeholder = 'Describe what math is in the image or press Send to analyze...';
    }, 500);
  } catch (error) {
    alert('Camera access denied or unavailable.');
  }
});

// Gallery upload
galleryBtn.addEventListener('click', () => {
  imageInput.click();
});

imageInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (event) => {
      currentImageData = event.target.result;
      previewImg.src = currentImageData;
      imagePreview.style.display = 'block';
      inputField.placeholder = 'Describe what math is in the image or press Send to analyze...';
    };
    reader.readAsDataURL(file);
  }
});

// Microphone
micBtn.addEventListener('click', () => {
  if (!recognition) {
    alert('Speech recognition not supported in this browser.');
    return;
  }
  if (isRecording) {
    recognition.stop();
  } else {
    isRecording = true;
    inputField.value = '';
    recognition.start();
  }
});

function loadHistory() {
  const saved = window.localStorage.getItem(historyKey);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        chatState.messages = parsed;
        chatState.historySessions = [];
      } else if (parsed && parsed.messages) {
        chatState.messages = parsed.messages || [];
        chatState.historySessions = parsed.historySessions || [];
      }
      renderMessages();
      renderHistorySidebar();
    } catch (error) {
      console.warn('Unable to load history', error);
      chatState.messages = [];
      chatState.historySessions = [];
    }
  }
}

function saveHistory() {
  window.localStorage.setItem(historyKey, JSON.stringify(chatState));
}

function renderHistorySidebar() {
  const historyList = document.querySelector('#history-list');
  if (!historyList) return;

  historyList.innerHTML = '';

  if (!chatState.historySessions.length) {
    historyList.innerHTML = `
      <div class="chat-summary"><strong>No saved chats yet</strong><span>Your previous math sessions will appear here after you start a new chat.</span></div>
    `;
    return;
  }

  chatState.historySessions.forEach((session) => {
    const item = document.createElement('div');
    item.className = 'chat-summary';
    item.innerHTML = `
      <strong>${session.title}</strong>
      <span>${new Date(session.timestamp).toLocaleString()}</span>
    `;
    item.addEventListener('click', () => {
      chatState.messages = session.messages.slice();
      renderMessages();
    });
    historyList.appendChild(item);
  });
}

function startNewChat() {
  if (chatState.messages.length) {
    const firstUser = chatState.messages.find((m) => m.role === 'user');
    const sessionTitle = firstUser ? firstUser.content : 'Math session';
    chatState.historySessions.unshift({
      id: Date.now(),
      title: sessionTitle.length > 48 ? `${sessionTitle.slice(0, 45)}...` : sessionTitle,
      messages: chatState.messages.slice(),
      timestamp: Date.now()
    });
  }
  chatState.messages = [];
  saveHistory();
  renderMessages();
  renderHistorySidebar();
}

function stripGradeMarkers(question) {
  return question.replace(/\b(grade|grade level|year|yr|class)\s*(\d{1,2})(st|nd|rd|th)?\b/gi, '').trim();
}


function appendMessage(role, content, imageData = null) {
  chatState.messages.push({ role, content, imageData, timestamp: Date.now() });
  renderMessages();
  saveHistory();
}

function createMessageElement(message) {
  const wrapper = document.createElement('div');
  wrapper.className = `message ${message.role}`;

  const title = document.createElement('div');
  title.className = 'message-title';
  title.textContent = message.role === 'user' ? 'You' : 'Tutor AI';

  const body = document.createElement('div');
  body.className = 'message-body';

  if (message.imageData) {
    const img = document.createElement('img');
    img.src = message.imageData;
    img.style.maxHeight = '160px';
    img.style.borderRadius = '12px';
    img.style.marginBottom = '8px';
    body.appendChild(img);
  }

  if (message.role === 'assistant' && message.content.type === 'steps') {
    body.innerHTML += renderSteps(message.content);
    const actions = document.createElement('div');
    actions.className = 'message-actions';
    const copyBtn = document.createElement('button');
    copyBtn.textContent = 'Copy answer';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(message.content.finalAnswer).then(() => {
        copyBtn.textContent = 'Copied!';
        setTimeout(() => { copyBtn.textContent = 'Copy answer'; }, 1200);
      });
    });
    actions.appendChild(copyBtn);
    body.appendChild(actions);
  } else if (message.role === 'assistant' && message.content.type === 'text') {
    body.textContent = message.content.text;
  } else {
    body.textContent = message.content;
  }

  wrapper.appendChild(title);
  wrapper.appendChild(body);
  return wrapper;
}

function renderSteps(content) {
  let html = `
    <div class="solution-block">
      <div class="solution-section">
        <strong>📋 Given:</strong>
        <div class="content">${content.given}</div>
      </div>
      <div class="solution-section">
        <strong>📐 Formula:</strong>
        <div class="content">${content.formula}</div>
      </div>
  `;

  if (content.explanation) {
    html += `
      <div class="solution-section">
        <strong>💡 Explanation:</strong>
        <div class="content">${content.explanation}</div>
      </div>
    `;
  }

  html += `
      <div class="solution-section">
        <strong>🔄 Substitution:</strong>
        <div class="content">${content.substitution}</div>
      </div>
      <div class="solution-section">
        <strong>⚙️ Calculation:</strong>
        <div class="content">${content.calculation}</div>
      </div>
  `;

  if (content.verification) {
    html += `
      <div class="solution-section verification">
        <strong>✅ Verification:</strong>
        <div class="content">${content.verification}</div>
      </div>
    `;
  }

  html += `
      <div class="solution-section final-answer-block">
        <strong>🎯 Final Answer:</strong>
        <div class="final-answer">${content.finalAnswer}</div>
      </div>
  `;

  if (content.verified) {
    html += `
      <div class="verification-badge">
        <span class="badge-icon">✓</span>
        <span class="badge-text">Verified Answer</span>
      </div>
    `;
  }

  html += `
    </div>
  `;

  return html;
}

function renderMessages() {
  chatWindow.innerHTML = '';
  chatState.messages.forEach((message) => {
    const el = createMessageElement(message);
    chatWindow.appendChild(el);
  });
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function normalizeText(text) {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

async function respondToQuestion(question) {
  const cleanedQuestion = stripGradeMarkers(question);
  if (!cleanedQuestion && currentImageData) {
    return {
      type: 'text',
      text: 'Image-based math recognition is not available yet. Please add a text math question or include numeric values with your image request.'
    };
  }

  const query = cleanedQuestion || question;

  // Try backend first (if available)
  try {
    const response = await fetch('http://localhost:3001/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query, image: currentImageData })
    });
    if (response.ok) {
      return await response.json();
    }
  } catch (error) {
    console.log('Backend not available, using local solver');
  }

  // Fallback to local solver
  const normalized = normalizeText(query);

  if (/explain|what is|define|describe/.test(normalized) && !/[0-9=]/.test(normalized)) {
    return { type: 'text', text: createConceptAnswer(normalized) };
  }

  const solver = buildSolver();
  const response = solver(query);
  return response;
}

function buildSolver() {
  return (question) => {
    const cleanedQuestion = stripGradeMarkers(question);
    const normalized = normalizeText(cleanedQuestion);
    const preprocessed = convertWordProblem(cleanedQuestion);
    const operatorExpression = extractArithmeticExpression(preprocessed);

    if (/solve\s+.*x|\b[xX]\b.*=/.test(cleanedQuestion)) {
      return solveLinearEquation(cleanedQuestion);
    }

    if (/area\s+of\s+circle|circle.*area|area\s+of\s+rectangle|perimeter|circumference|triangle.*area|square.*area/.test(normalized)) {
      return solveGeometry(cleanedQuestion);
    }

    if (operatorExpression) {
      return solveArithmetic(operatorExpression, cleanedQuestion);
    }

    if (/sum\b|difference\b|product\b|quotient\b|twice\b|half\b|three times\b|four times\b/.test(normalized)) {
      return solveArithmetic(preprocessed, cleanedQuestion);
    }

    return {
      type: 'text',
      text: 'I detected a math topic, but I need a clearer number expression. Try a direct arithmetic problem or a basic algebra/geometry question. You can also ask grade-level questions like "Grade 5: add 345 + 212".'
    };
  };
}

function createConceptAnswer(normalized) {
  if (normalized.includes('pythagoras') || normalized.includes('pythagorean')) {
    return 'Pythagoras theorem states that in a right triangle, the square of the hypotenuse is equal to the sum of the squares of the other two sides: a² + b² = c². It helps you compute one side when the other two are known.';
  }

  if (normalized.includes('area of circle') || normalized.includes('circle area')) {
    return 'The area of a circle is A = πr², where r is the radius. Example: if r = 3, then A = π × 3² = 9π.';
  }

  if (normalized.includes('solve') && normalized.includes('equation')) {
    return 'For linear equations like 2x + 5 = 15, isolate x by moving constants to the opposite side and dividing by the coefficient of x.';
  }

  return 'This is a math question and I can help with arithmetic, algebra, geometry, and step-by-step solutions. Please include numbers or a specific formula request.';
}

function convertWordProblem(question) {
  let text = question.toLowerCase();
  text = text.replace(/what is|calculate|find|the value of|evaluate/g, '');
  text = text.replace(/sum of ([0-9]+) and ([0-9]+)/g, '($1 + $2)');
  text = text.replace(/difference between ([0-9]+) and ([0-9]+)/g, '($1 - $2)');
  text = text.replace(/product of ([0-9]+) and ([0-9]+)/g, '($1 * $2)');
  text = text.replace(/quotient of ([0-9]+) and ([0-9]+)/g, '($1 / $2)');
  text = text.replace(/twice ([0-9]+)/g, '2 * $1');
  text = text.replace(/half of ([0-9]+)/g, '($1 / 2)');
  text = text.replace(/three times ([0-9]+)/g, '3 * $1');
  text = text.replace(/four times ([0-9]+)/g, '4 * $1');
  return text;
}

function extractArithmeticExpression(text) {
  const expression = text.match(/([0-9\.]+\s*[-+*\/\\]\s*[0-9\.]+(\s*[-+*\/\\]\s*[0-9\.]+)*)/);
  if (expression) {
    return expression[1].replace(/\\/g, '/');
  }
  return null;
}

function solveArithmetic(expression, question) {
  try {
    const value = math.evaluate(expression);
    return {
      type: 'steps',
      given: `Expression: ${expression}`,
      formula: 'Compute the arithmetic expression directly.',
      substitution: `Substitute the values: ${expression}`,
      calculation: `Evaluate the expression: ${value}`,
      finalAnswer: `${value}`
    };
  } catch (error) {
    return { type: 'text', text: 'I could not compute that expression directly. Please check the syntax, and try again with clear arithmetic or a linear equation.' };
  }
}

function solveLinearEquation(question) {
  try {
    const cleaned = question.replace(/solve|find|for/g, '').replace(/\s+/g, '');
    const [lhs, rhs] = cleaned.split('=');
    if (!lhs || !rhs) {
      return { type: 'text', text: 'I need a valid equation with an equals sign, for example: 2x + 5 = 15.' };
    }

    const left = parseLinearSide(lhs);
    const right = parseLinearSide(rhs);
    const coefficient = left.coefficient - right.coefficient;
    const constant = right.constant - left.constant;

    if (coefficient === 0) {
      if (constant === 0) {
        return { type: 'text', text: 'This equation has infinitely many solutions.' };
      }
      return { type: 'text', text: 'This equation has no solution.' };
    }

    const solution = constant / coefficient;
    return {
      type: 'steps',
      given: `Equation: ${lhs} = ${rhs}`,
      formula: 'Move x terms to one side and constants to the other: x = (right constant - left constant) / coefficient of x.',
      substitution: `x = (${right.constant} - ${left.constant}) / ${coefficient}`,
      calculation: `x = ${constant} / ${coefficient} = ${solution}`,
      finalAnswer: `x = ${solution}`
    };
  } catch (error) {
    return { type: 'text', text: 'I could not solve the equation. Try a simpler linear equation like 2x + 5 = 15.' };
  }
}

function parseLinearSide(side) {
  const expression = side.replace(/-/g, '+-');
  const parts = expression.split('+').filter(Boolean);
  return parts.reduce((acc, term) => {
    if (term.includes('x')) {
      const value = term.replace('x', '') || '1';
      const coefficient = Number(value === '-' ? -1 : value);
      return { ...acc, coefficient: acc.coefficient + coefficient };
    }
    return { ...acc, constant: acc.constant + Number(term) };
  }, { coefficient: 0, constant: 0 });
}

function solveGeometry(question) {
  const normalized = normalizeText(question);
  if (/area.+circle|circle.+area/.test(normalized)) {
    const rMatch = normalized.match(/radius\s*(?:is|=)?\s*([0-9\.]+)/);
    const r = rMatch ? Number(rMatch[1]) : null;
    if (!r) {
      return { type: 'text', text: 'Please provide the radius to compute the area of a circle, for example: area of circle with radius 5.' };
    }
    const area = math.round(Math.PI * r * r, 6);
    return {
      type: 'steps',
      given: `Radius r = ${r}`,
      formula: 'Area = π × r²',
      substitution: `Area = π × ${r}²`,
      calculation: `Area = π × ${math.round(r * r, 6)} = ${area}`,
      finalAnswer: `Area = ${area}`
    };
  }

  if (/circumference.+circle|perimeter.+circle/.test(normalized)) {
    const rMatch = normalized.match(/radius\s*(?:is|=)?\s*([0-9\.]+)/);
    const r = rMatch ? Number(rMatch[1]) : null;
    if (!r) {
      return { type: 'text', text: 'Please include the radius to compute the circumference, for example: circumference of a circle with radius 4.' };
    }
    const circumference = math.round(2 * Math.PI * r, 6);
    return {
      type: 'steps',
      given: `Radius r = ${r}`,
      formula: 'Circumference = 2 × π × r',
      substitution: `Circumference = 2 × π × ${r}`,
      calculation: `Circumference = ${math.round(2 * r, 6)}π = ${circumference}`,
      finalAnswer: `Circumference = ${circumference}`
    };
  }

  if (/area.+rectangle|rectangle.+area/.test(normalized)) {
    const dims = normalized.match(/(length|l)\s*(?:is|=)?\s*([0-9\.]+).*?(width|w)\s*(?:is|=)?\s*([0-9\.]+)/);
    const numbers = [...normalized.matchAll(/([0-9\.]+)/g)].map(m => Number(m[1]));
    const l = dims ? Number(dims[2]) : numbers[0];
    const w = dims ? Number(dims[4]) : numbers[1];
    if (!l || !w) {
      return { type: 'text', text: 'Please provide both length and width to compute rectangle area, for example: area of rectangle with length 5 and width 3.' };
    }
    const area = math.round(l * w, 6);
    return {
      type: 'steps',
      given: `Length = ${l}, Width = ${w}`,
      formula: 'Area = length × width',
      substitution: `Area = ${l} × ${w}`,
      calculation: `Area = ${area}`,
      finalAnswer: `Area = ${area}`
    };
  }

  if (/perimeter.+rectangle|rectangle.+perimeter/.test(normalized)) {
    const numbers = [...normalized.matchAll(/([0-9\.]+)/g)].map(m => Number(m[1]));
    const l = numbers[0];
    const w = numbers[1];
    if (!l || !w) {
      return { type: 'text', text: 'Please provide both length and width to compute rectangle perimeter.' };
    }
    const perimeter = math.round(2 * (l + w), 6);
    return {
      type: 'steps',
      given: `Length = ${l}, Width = ${w}`,
      formula: 'Perimeter = 2 × (length + width)',
      substitution: `Perimeter = 2 × (${l} + ${w})`,
      calculation: `Perimeter = ${perimeter}`,
      finalAnswer: `Perimeter = ${perimeter}`
    };
  }

  if (/triangle.+area/.test(normalized) || /area.+triangle/.test(normalized)) {
    const nums = [...normalized.matchAll(/([0-9\.]+)/g)].map(m => Number(m[1]));
    const base = nums[0];
    const height = nums[1];
    if (!base || !height) {
      return { type: 'text', text: 'Please provide base and height for a triangle area calculation.' };
    }
    const area = math.round((base * height) / 2, 6);
    return {
      type: 'steps',
      given: `Base = ${base}, Height = ${height}`,
      formula: 'Area = 1/2 × base × height',
      substitution: `Area = 1/2 × ${base} × ${height}`,
      calculation: `Area = ${area}`,
      finalAnswer: `Area = ${area}`
    };
  }

  return { type: 'text', text: 'I recognize geometry, but I need the shape and dimensions clearly to compute the answer.' };
}

async function handleSend() {
  const question = inputField.value.trim();
  if (!question && !currentImageData) return;
  
  const displayText = question || (currentImageData ? 'Image analysis' : '');
  appendMessage('user', displayText, currentImageData);
  inputField.value = '';
  currentImageData = null;
  imagePreview.style.display = 'none';
  inputField.placeholder = 'Ask a math question or use voice/camera...';

  setTimeout(async () => {
    const answer = await respondToQuestion(question);
    appendMessage('assistant', answer);
  }, 260);
}

function clearChat() {
  chatState.messages = [];
  saveHistory();
  renderMessages();
}

function toggleTheme() {
  document.documentElement.classList.toggle('light-mode');
}

sendBtn.addEventListener('click', handleSend);
inputField.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault();
    handleSend();
  }
});

newChatBtn.addEventListener('click', startNewChat);
themeToggle.addEventListener('change', toggleTheme);

suggestions.forEach((tag) => {
  tag.addEventListener('click', () => {
    inputField.value = tag.textContent;
    inputField.focus();
  });
});

loadHistory();
if (!chatState.messages.length) {
  appendMessage('assistant', { type: 'text', text: 'Welcome! Ask me any math question via text, voice (🎤), or image (📷). I\'ll solve it step-by-step. Try: "Solve 2x + 5 = 15" or "Area of circle with radius 5"' });
}
