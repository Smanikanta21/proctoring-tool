const createApp = require('./app');

const port = Number(process.env.PORT || 3005);
createApp().listen(port, '0.0.0.0', () => {
  console.log(`Exam backend running at http://localhost:${port}`);
});
