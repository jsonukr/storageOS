import { createBrowserRouter } from "react-router-dom";
import { AppLayout } from "../layouts/AppLayout";
import { Explorer, Transfers, Devices, Settings } from "../pages";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <Explorer /> },
      { path: "transfers", element: <Transfers /> },
      { path: "devices", element: <Devices /> },
      { path: "settings", element: <Settings /> },
    ],
  },
]);
