import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@xecms/ui/theme.css";
import "./studio.css";
import { createBuilderRouter } from "./router.js";

const element = document.getElementById("root");
if (element === null) throw new Error("App Builder root element was not found.");
createRoot(element).render(<StrictMode><RouterProvider router={createBuilderRouter()} /></StrictMode>);
