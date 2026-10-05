import { render, screen } from "@testing-library/react";
import { SignedInAs } from "./SignedInAs";

it("shows who is signed in", () => {
  render(<SignedInAs name="Demo User" />);

  expect(screen.getByText("Signed in as Demo User")).toBeInTheDocument();
});
