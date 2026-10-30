import { QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { BrowserRouter, Switch, Route } from "react-router-dom";
import Header from "../Header/Header";
import Score from "../Score/Score";
import { createQueryClient } from "../api/queryClient";
import "./App.scss";

function App() {
  // Held in state so each mount gets its own cache; tests would otherwise
  // share one client across cases.
  const [queryClient] = useState(createQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <div id="wrapper">
        <Switch>
          <Route path="/home" render={() => (
            <div className="App">
              <Header />
          </div>
          )} />
          {/* Score renders its own header, because the live badge in the bar
              is driven by the scores it has already fetched. */}
          <Route path="/score" render={() => (
            <div className="App">
              <Score />
          </div>
          )} />
          <Route path="/" render={() => (
            <div className="App">
              <Score />
          </div>
          )} />
        </Switch>
      </div>
    </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
