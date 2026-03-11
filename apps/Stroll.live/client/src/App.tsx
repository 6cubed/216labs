import { Route, Switch } from "wouter";
import { LocationPrompt } from "./pages/LocationPrompt";
import { Feed } from "./pages/Feed";
import { Admin } from "./pages/Admin";

export default function App() {
  return (
    <Switch>
      <Route path="/admin" component={Admin} />
      <Route path="/feed" component={Feed} />
      <Route path="/" component={LocationPrompt} />
    </Switch>
  );
}
