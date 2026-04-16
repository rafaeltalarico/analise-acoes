import { useState } from "react";
import { Search } from "lucide-react";
import { Link } from "react-router-dom";
import { Menu, X } from "lucide-react";

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    return (
      <nav className="border-b bg-white/80 backdrop-blur-md w-full ">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-12 md:h-16 items-center">
            <div className="flex shrink-0">          
              <Link to="/" className="flex items-center gap-2">
                <span className="h-8 w-8 rounded-full bg-gradient-to-br from-synergy-blue to-synergy-green flex items-center justify-center">
                  <svg 
                    xmlns="http://www.w3.org/2000/svg" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    className="w-5 h-5 text-white"
                  >
                    <path d="M3 3v18h18" />
                    <path d="M18 9l-1.2 1.2a6 6 0 0 1-7.6 0L8 9" />
                    <path d="M12 12v6" />
                    <path d="M8 7l.01 0" />
                    <path d="M12 7l.01 0" />
                    <path d="M16 7l.01 0" />
                  </svg>
                </span>
                <span className="font-semibold text-lg text-synergy-dark">LuminAI</span>
              </Link>
            </div>
            <div className="hidden md:flex flex-1 justify-center items-center space-x-4">
              <Link 
                to="/dashboard" 
                className="px-3 py-2 rounded-md text-sm font-medium text-synergy-dark hover:bg-muted transition-colors duration-200"
              >
                Dashboard
              </Link>
              <Link 
                to="/analytics" 
                className="px-3 py-2 rounded-md text-sm font-medium text-synergy-dark hover:bg-muted transition-colors duration-200"
              >
                Análises
              </Link>
              <Link 
                to="/estoque" 
                className="px-3 py-2 rounded-md text-sm font-medium text-synergy-dark hover:bg-muted transition-colors duration-200"
              >
                Estoque
              </Link>
            </div>
            <div className="md:hidden flex items-center">
              <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 rounded-md hover:bg-muted transition">
                {isMobileMenuOpen ? <X className="h-6 w-6 text-synergy-dark" /> : <Menu className="h-6 w-6 text-synergy-dark" />}
              </button>
            </div>
          </div>
          {isMobileMenuOpen && (
            <div className="md:hidden flex flex-col space-y-2 mt-2 p-2">
              <Link to="/dashboard" onClick={() => setIsMobileMenuOpen(false)} className="block px-4 py-2 text-synergy-dark hover:bg-muted">Dashboard</Link>
              <Link to="/analytics" onClick={() => setIsMobileMenuOpen(false)} className="block px-4 py-2 text-synergy-dark hover:bg-muted">Análises</Link>
              <Link to="/estoque" onClick={() => setIsMobileMenuOpen(false)} className="block px-4 py-2 text-synergy-dark hover:bg-muted">Estoque</Link>
            </div>
          )}  
          
        </div>
      </nav>
    );
  };

export default Navbar;
