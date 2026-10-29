import { BrowserRouter, Switch, Route } from "react-router-dom";
import Header from "../Header/Header";
import Score from "../Score/Score";
import "./App.scss";

function App() {
  return (
    <BrowserRouter>
      <div id="wrapper">
        <Switch>
          <Route path="/home" render={() => (
            <div className="App">
              <Header />
          </div>
          )} />
          <Route path="/score" render={() => (
            <div className="App">
              <Header />
              <Score />
          </div>
          )} />
          <Route path="/" render={() => (
            <div className="App">
              <Header />
              <Score />
          </div>
          )} />
        </Switch>
      </div>
    </BrowserRouter>
  );
}

export default App;
