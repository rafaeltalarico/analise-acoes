
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface InfoCardProps {
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
}

const InfoCard = ({ title, description, className, children }: InfoCardProps) => {
  return (
    <Card className={cn("border border-synergy-blue/10 transition-all hover:shadow-md", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-medium">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
};

export default InfoCard;
