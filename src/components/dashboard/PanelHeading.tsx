import type { ReactNode } from "react";

interface PanelHeadingProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export default function PanelHeading({ title, description, action }: PanelHeadingProps) {
  return (
    <div className="panel-heading">
      <div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && <div className="panel-actions">{action}</div>}
    </div>
  );
}
