import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { Dashboard, Explorer, Transfers, Devices, Settings } from "../pages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Dashboard /> },
      { path: "explorer", element: <Explorer /> },
      { path: "transfers", element: <Transfers /> },
      { path: "devices", element: <Devices /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
