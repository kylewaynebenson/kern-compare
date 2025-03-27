# Font Kerning Comparison App - Setup Guide

This guide will walk you through setting up the Font Kerning Comparison application in your local environment and deploying it to GitHub Pages.

## Project Setup

### 1. Create a new React project with Vite

```bash
# Create a new project using Vite with React and TypeScript
npm create vite@latest font-kerning-comparison -- --template react-ts

# Navigate to the project directory
cd font-kerning-comparison
```

### 2. Install Dependencies

```bash
# Install core dependencies
npm install react react-dom opentype.js

# Install UI components and styling libraries
npm install tailwindcss postcss autoprefixer
npm install class-variance-authority clsx tailwind-merge
npm install lucide-react
npm install -D @types/node

# Install shadcn/ui CLI
npm install -D @shadcn/ui
```

### 3. Initialize Tailwind CSS

```bash
npx tailwindcss init -p
```

### 4. Set up shadcn/ui

```bash
npx shadcn-ui@latest init
```

During setup, select:
- TypeScript: Yes
- Style: Default (or whichever you prefer)
- Base color: Slate (or your preference)
- Global CSS path: src/index.css
- CSS variables: Yes
- React Server Components: No
- Components directory: src/components
- Utils directory: src/lib/utils

### 5. Install shadcn/ui components

```bash
# Install required components
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
npx shadcn-ui@latest add label
npx shadcn-ui@latest add tabs
npx shadcn-ui@latest add slider
npx shadcn-ui@latest add select
npx shadcn-ui@latest add alert
npx shadcn-ui@latest add alert-dialog
npx shadcn-ui@latest add badge
npx shadcn-ui@latest add separator
npx shadcn-ui@latest add switch
```

## Configuration Files

### package.json

Update your `package.json` to include deployment scripts:

```json
{
  "name": "font-kerning-comparison",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "predeploy": "npm run build",
    "deploy": "gh-pages -d dist"
  },
  "dependencies": {
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "lucide-react": "^0.299.0",
    "opentype.js": "^1.3.4",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.5",
    "gh-pages": "^6.1.1",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}
```

### tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

### vite.config.ts

Create or update your Vite configuration file for GitHub Pages:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/font-kerning-comparison/', // Replace with your repository name
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

### src/lib/utils.ts

Create a utils file for the shadcn/ui components:

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

## Project Structure

Organize your project files like this:

```
font-kerning-comparison/
├── public/
├── src/
│   ├── components/
│   │   ├── ui/
│   │   │   ├── button.tsx
│   │   │   ├── card.tsx
│   │   │   └── ...
│   ├── lib/
│   │   └── utils.ts
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── .gitignore
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.ts
```

## Create Main App Component

Place your KerningComparison component code in `src/App.tsx`:

```typescript
import React from 'react';
import KerningComparison from './components/KerningComparison';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <KerningComparison />
    </div>
  );
}

export default App;
```

Create a new file `src/components/KerningComparison.tsx` and paste the component code from our artifact.

## GitHub Pages Deployment

### 1. Install gh-pages package

```bash
npm install -D gh-pages
```

### 2. Create GitHub Repository

1. Create a new repository on GitHub named `font-kerning-comparison`
2. Initialize git in your local project (if not already done):

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/yourusername/font-kerning-comparison.git
git push -u origin main
```

### 3. Deploy to GitHub Pages

```bash
npm run deploy
```

This will:
1. Build your project
2. Create a gh-pages branch (or update it)
3. Push the built files to that branch

### 4. Configure GitHub Pages in Repository Settings

1. Go to your repository on GitHub
2. Navigate to Settings > Pages
3. Source: Deploy from a branch
4. Branch: gh-pages / (root)
5. Save

## Additional Development Notes

### Loading OpenType.js

Add the following to your `index.html` file in the `<head>` section:

```html
<script src="https://cdn.jsdelivr.net/npm/opentype.js@latest/dist/opentype.min.js"></script>
```

Or import it normally in your component file:

```typescript
import opentype from 'opentype.js';
```

### Troubleshooting Common Issues

1. **shadcn/ui component errors**: Make sure you have installed all required components and their dependencies.

2. **Paths not resolving**: Check your path aliases in both `vite.config.ts` and `tsconfig.json`.

3. **GitHub Pages not updating**: Remember that it can take a few minutes for changes to appear after deployment.

4. **Fonts not loading**: Ensure you're handling font files correctly and creating blob URLs properly.

5. **OpenType.js errors**: Check if the library is correctly loaded and accessible in your component.

## Running Locally

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview the production build locally
npm run preview
```

## Resources

- [Vite Documentation](https://vitejs.dev/guide/)
- [Shadcn UI Documentation](https://ui.shadcn.com/docs)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [OpenType.js Documentation](https://github.com/opentypejs/opentype.js)
- [GitHub Pages Documentation](https://docs.github.com/en/pages)
