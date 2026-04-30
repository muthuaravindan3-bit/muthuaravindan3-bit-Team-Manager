const fs = require('fs');
const glob = require('fs/promises');

// Just doing it raw since we know exactly which files are failing
const filesToEdit = [
    'src/components/admin/RosterManagement.tsx',
    'src/components/admin/AnalyticsHub.tsx',
    'src/components/LiveRoster.tsx',
    'src/components/ShiftLogger.tsx',
    'src/components/Dashboard.tsx'
];

const replacements = [
    [/\bbg-zinc-900\b/g, "glass-card"],
    [/\bbg-black\/40\b/g, "bg-surface-2"],
    [/\bbg-black\/20\b/g, "bg-surface-2"],
    [/\bbg-black\b/g, "bg-surface-3"],
    [/\bbg-white\/5\b/g, "bg-surface-2"],
    [/\bbg-white\/10\b/g, "bg-surface-3"],
    
    [/\bborder-white\/5\b/g, "border-main-border"],
    [/\bborder-white\/10\b/g, "border-main-border/80"],
    [/\bborder-white\/20\b/g, "border-main-border/80"],
    
    [/\btext-white\b/g, "text-main-text"],
    [/\btext-slate-200\b/g, "text-main-text"],
    [/\btext-slate-300\b/g, "text-main-text"],
    [/\btext-slate-400\b/g, "text-main-text-muted"],
    [/\btext-slate-500\b/g, "text-main-text-muted"],
    [/\btext-slate-600\b/g, "text-main-text-muted\/70"],
    [/\btext-slate-700\b/g, "text-main-text-muted\/50"],
    [/\btext-slate-800\b/g, "text-main-text-muted\/30"],
    [/\btext-slate-900\b/g, "text-main-text-muted\/20"],
    
    [/\btext-indigo-300\b/g, "text-primary-hover"],
    [/\btext-indigo-400\b/g, "text-primary"],
    [/\btext-indigo-500\b/g, "text-primary"],
    [/\btext-indigo-600\b/g, "text-primary"],
    [/\bbg-indigo-500\/10\b/g, "bg-primary\/10"],
    [/\bbg-indigo-500\/20\b/g, "bg-primary\/20"],
    [/\bbg-indigo-600\/10\b/g, "bg-primary\/10"],
    [/\bbg-indigo-500\b/g, "bg-primary"],
    [/\bbg-indigo-600\b/g, "bg-primary"],
    [/\bbg-indigo-700\b/g, "bg-primary-hover"],
    [/\bhover:bg-indigo-700\b/g, "hover:bg-primary-hover"],
    [/\bborder-indigo-500\/20\b/g, "border-primary\/20"],
    [/\bborder-indigo-500\b/g, "border-primary"],
    [/\bring-indigo-500\/20\b/g, "ring-primary\/20"],
    [/\bring-indigo-500\/30\b/g, "ring-primary\/30"],
    [/\bring-indigo-500\b/g, "ring-primary"],
    [/\bfocus:ring-indigo-500\b/g, "focus:ring-primary"],
    [/\bfocus:border-indigo-500\b/g, "focus:border-primary"],
    [/\bhover:text-indigo-300\b/g, "hover:text-primary-hover"],
    [/\bhover:text-indigo-400\b/g, "hover:text-primary"],
    [/\bhover:border-indigo-500\/20\b/g, "hover:border-primary\/20"],
    [/\bshadow-indigo-600\/20\b/g, "shadow-primary\/20"],
    [/\bshadow-indigo-500\/20\b/g, "shadow-primary\/20"],
    [/\bshadow-indigo-500\/5\b/g, "shadow-primary\/5"],
    
    [/\btext-amber-400\b/g, "text-warning"],
    [/\btext-amber-500\b/g, "text-warning"],
    [/\bbg-amber-500\/10\b/g, "bg-warning\/10"],
    [/\bbg-amber-500\/20\b/g, "bg-warning\/20"],
    [/\bbg-amber-500\b/g, "bg-warning"],
    [/\bbg-amber-600\b/g, "bg-warning"],
    [/\bborder-amber-400\b/g, "border-warning\/80"],
    [/\bborder-amber-500\/20\b/g, "border-warning\/20"],
    [/\bshadow-amber-500\/20\b/g, "shadow-warning\/20"],
    
    [/\btext-emerald-400\b/g, "text-success"],
    [/\btext-emerald-500\b/g, "text-success"],
    [/\bbg-emerald-500\/10\b/g, "bg-success\/10"],
    [/\bbg-emerald-500\b/g, "bg-success"],
    [/\bbg-emerald-600\b/g, "bg-success"],
    [/\bborder-emerald-400\b/g, "border-success\/80"],
    [/\bborder-emerald-500\/20\b/g, "border-success\/20"],
    [/\bshadow-emerald-500\/20\b/g, "shadow-success\/20"],
    
    [/\btext-red-400\b/g, "text-error"],
    [/\btext-red-500\b/g, "text-error"],
    [/\bbg-red-500\/10\b/g, "bg-error-subtle"],
    [/\bbg-red-500\b/g, "bg-error"],
    [/\bbg-red-600\b/g, "bg-error"],
    [/\bborder-red-400\b/g, "border-error\/80"],
    [/\bborder-red-500\/20\b/g, "border-error\/20"],
    [/\bhover:bg-red-500\/10\b/g, "hover:bg-error-subtle"],
    [/\bhover:bg-red-500\/20\b/g, "hover:bg-error-subtle"],
    [/\bhover:text-red-500\b/g, "hover:text-error"],
    [/\bshadow-red-500\/20\b/g, "shadow-error\/20"],
    
    [/\btext-blue-400\b/g, "text-info"],
    [/\btext-blue-500\b/g, "text-info"],
    [/\bbg-blue-500\/10\b/g, "bg-info\/10"],
    [/\bbg-blue-500\b/g, "bg-info"],
    [/\bborder-blue-400\b/g, "border-info\/80"],
    [/\bborder-blue-500\/20\b/g, "border-info\/20"],
    [/\bshadow-blue-500\/20\b/g, "shadow-info\/20"],
];

for (const filepath of filesToEdit) {
    if (!fs.existsSync(filepath)) {
        continue;
    }

    let content = fs.readFileSync(filepath, 'utf8');
    
    for (const [oldRegex, newStr] of replacements) {
        content = content.replace(oldRegex, newStr);
    }
        
    fs.writeFileSync(filepath, content, 'utf8');
    console.log(`Updated ${filepath}`);
}
