import Chat from "./components/Chat";
import Report from "./components/Report";

export default function App() {
  const isReport =
    typeof window !== "undefined" && window.location.pathname === "/report";
  return <div className="app">{isReport ? <Report /> : <Chat />}</div>;
}
