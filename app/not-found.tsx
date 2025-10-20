import Link from "next/link";
import { Placeholder } from "@/components/placeholder";
import { Button } from "@/components/ui/button";
import { homePath } from "@/lib/paths";

export default function NotFound(){
    return (
        <Placeholder
          label="Page not found"
          button={
            <Button asChild variant="outline">
              <Link href={homePath()}>Return Home</Link>
            </Button>
          }
        />
      );
}