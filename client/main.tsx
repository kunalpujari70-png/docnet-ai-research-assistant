import { createRoot } from "react-dom/client";
import App from "./App";

// Add global error handler
window.addEventListener('error', (event) => {
  console.error('Global error caught:', event.error);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
});

const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    const root = createRoot(rootElement);
    root.render(<App />);
  } catch (error) {
    console.error('Error rendering React app:', error);
    rootElement.innerHTML = `
      <div style="
        padding: 20px; 
        background: red; 
        color: white;
        margin: 20px;
        font-size: 18px;
        font-family: Arial, sans-serif;
        border: 2px solid darkred;
        border-radius: 8px;
      ">
        <h1>🚨 React Error</h1>
        <p>Error: ${error.message}</p>
        <p>Check the browser console for more details.</p>
        <button onclick="window.location.reload()" style="padding: 10px; margin: 10px; background: white; color: red; border: none; border-radius: 4px; cursor: pointer;">
          Reload Page
        </button>
      </div>
    `;
  }
} else {
  console.error('Root element not found!');
  document.body.innerHTML = `
    <div style="
      padding: 20px; 
      background: red; 
      color: white;
      margin: 20px;
      font-size: 18px;
      font-family: Arial, sans-serif;
      border: 2px solid darkred;
      border-radius: 8px;
    ">
      <h1>🚨 Root Element Not Found</h1>
      <p>The root element with id "root" was not found in the HTML.</p>
      <button onclick="window.location.reload()" style="padding: 10px; margin: 10px; background: white; color: red; border: none; border-radius: 4px; cursor: pointer;">
        Reload Page
      </button>
    </div>
  `;
}
