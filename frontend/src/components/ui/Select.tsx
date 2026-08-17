import { forwardRef, type SelectHTMLAttributes } from "react";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  mono?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { mono = false, className = "", children, ...rest },
  ref
) {
  const classes = ["select", mono && "select--mono", className].filter(Boolean).join(" ");
  return (
    <select ref={ref} className={classes} {...rest}>
      {children}
    </select>
  );
});
