import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { init } from '@telegram-apps/sdk-react';
try {
    init();
} catch (e) {
    console.log(e)
}
createRoot(document.getElementById("root")!).render(<App />);
