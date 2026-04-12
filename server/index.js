const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const os = require('os');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  maxHttpBufferSize: 1e8,
});

app.use(express.json({ limit: '50mb' }));

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return 'localhost';
}

let session = {
  slides: [],
  currentSlide: 0,
  questions: [], // { id, text, slideIndex, ts, done }
};

function broadcastQuestions() {
  io.emit('questions-update', session.questions);
}

app.get('/', (req, res) => res.redirect('/student'));
app.get('/info', (req, res) => res.json({ ip: getLocalIP(), port: 3001 }));
app.get('/student', (req, res) => res.sendFile(path.join(__dirname, 'student.html')));

app.get('/slide/:index', (req, res) => {
  const slide = session.slides[parseInt(req.params.index)];
  if (!slide) return res.status(404).send('Not found');
  res.setHeader('Content-Type', 'image/png');
  res.send(Buffer.from(slide.replace(/^data:image\/\w+;base64,/, ''), 'base64'));
});

io.on('connection', (socket) => {
  if (session.slides.length > 0) {
    socket.emit('session', { count: session.slides.length, currentSlide: session.currentSlide });
  }
  socket.emit('questions-update', session.questions);

  socket.on('upload-slides', (slides) => {
    session.slides = slides;
    session.currentSlide = 0;
    io.emit('session', { count: slides.length, currentSlide: 0 });
  });

  socket.on('change-slide', (index) => {
    session.currentSlide = index;
    io.emit('slide-change', index);
  });

  // Student asks a question
  socket.on('submit-question', (text) => {
    if (!text?.trim()) return;
    const question = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: text.trim(),
      slideIndex: session.currentSlide,
      ts: Date.now(),
      done: false,
    };
    session.questions.unshift(question);
    broadcastQuestions();
  });

  // Teacher dismisses a question
  socket.on('dismiss-question', (id) => {
    session.questions = session.questions.filter(q => q.id !== id);
    broadcastQuestions();
  });

  // Teacher clears all
  socket.on('clear-questions', () => {
    session.questions = [];
    broadcastQuestions();
  });
});

server.listen(3001, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log(`\n✅ Server ready`);
  console.log(`   Teacher app:  http://localhost:3001`);
  console.log(`   Student view: http://${ip}:3001/student\n`);
});