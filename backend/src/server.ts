import express from 'express';

const app = express();
const port = Number(process.env.PORT || 3001);

app.use(express.json());

app.get('/', (_req, res) => {
  res.status(200).json({ service: 'abu-smartcomp-backend', status: 'ok' });
});

app.listen(port, () => {
  console.log(`backend listening on :${port}`);
});
