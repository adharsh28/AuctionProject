import ThemeToggle from "../components/ThemeToggle";

const Navbar = () => {
  return (
    <div className="flex justify-between items-center">
          <h1 className="text-xl sm:text-2xl md:text-2xl font-text font-bold  text-text">
            AuctionPlay
          </h1>
          <div className="">
            <ThemeToggle />
          </div>
          </div>
  )
}

export default Navbar