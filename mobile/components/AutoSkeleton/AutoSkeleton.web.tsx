// AutoSkeleton.web.tsx
import type { FC } from "react";
import type { AutoSkeletonProps } from "./types";

const AutoSkeleton: FC<AutoSkeletonProps> = ({ children }) => {
  return <>{children}</>;
};

export default AutoSkeleton;