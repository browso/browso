import React from "react";
import ReactDOM from "react-dom/client";
import { SettingsApp } from "./SettingsApp";
import "../../sidebar/src/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <SettingsApp />
  </React.StrictMode>
);
