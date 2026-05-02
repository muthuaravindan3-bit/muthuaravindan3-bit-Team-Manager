const fs = require('fs');
let content = fs.readFileSync('src/components/Troubleshooter.tsx', 'utf8');
content = content.replace("const thoughtMatch = fullText.match(/<thought>([\\\\s\\\\S]*?)(<\\\\/thought>|$)/);", "const thoughtMatch = fullText.match(/<thought>([\\\\s\\\\S]*?)(<\\/thought>|$)/);");
content = content.replace("const tMatch = item.guide.match(/<thought>([\\\\s\\\\S]*?)(<\\\\/thought>|$)/);", "const tMatch = item.guide.match(/<thought>([\\\\s\\\\S]*?)(<\\/thought>|$)/);");
fs.writeFileSync('src/components/Troubleshooter.tsx', content);
console.log('Fixed regex in Troubleshooter.tsx');
