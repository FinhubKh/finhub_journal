import fs from 'fs';

const buf = fs.readFileSync('./sample_data/Swing Entry at the pullback.html');
const text = new TextDecoder('utf-16le').decode(buf);
const lines = text.split('\n');
for(let i=0; i<lines.length; i++) {
  if (lines[i].includes('Maximal drawdown') || lines[i].includes('Equity Drawdown Maximal')) {
    console.log(lines[i-1]);
    console.log(lines[i]);
    console.log(lines[i+1]);
  }
}
