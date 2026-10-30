import "./Header.scss";

interface HeaderProps {
  /** Matches in play right now. The badge stays hidden when nothing is on. */
  liveCount?: number;
}

function Header({ liveCount = 0 }: HeaderProps) {
  return (
    <header className="headerContainer">
      <div className="headerContainer__content">
        <h2 className="header__title">
          ftbl<span className="header__title__tld">.world</span>
        </h2>

        {liveCount > 0 && (
          <span className="header__live" role="status">
            <span className="header__live__dot" />
            {liveCount} live
          </span>
        )}
      </div>
    </header>
  );
}

export default Header;
