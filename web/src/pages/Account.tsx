import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "lucide-react";

import { useDocumentMeta } from "@/src/components/useDocumentMeta";
import { useMe } from "@/src/features/auth/queries";
import { ProfileCard } from "@/src/features/account/ProfileCard";
import { ActivityCard } from "@/src/features/account/ActivityGraph";
import { AccountDetailsCard } from "@/src/features/account/AccountDetailsCard";
import { Skeleton } from "@/src/components/ui/skeleton";
import { PageContainer } from "@/src/components/PageContainer";

export default function Account() {
  useDocumentMeta({ title: "Account", noIndex: true });

  const navigate = useNavigate();
  const { data: user } = useMe();

  return (
    <PageContainer>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="eyebrow mb-6 flex cursor-pointer items-center gap-2 transition-colors hover:text-blue-hi"
      >
        <ArrowLeftIcon className="size-3" />
        Back
      </button>

      <h1 className="display-l mb-6">Account</h1>

      {user ? (
        <div className="space-y-5">
          <ProfileCard user={user} />
          <ActivityCard />
          <AccountDetailsCard user={user} />
        </div>
      ) : (
        <div className="space-y-5" aria-busy="true" aria-label="Loading your account">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-56 w-full rounded-lg" />
        </div>
      )}

      <p className="mt-8 text-center text-xs text-silver-500">
        tau only keeps a name and a picture, both optional. Your activity is
        yours alone: nobody else can see this page.
      </p>
    </PageContainer>
  );
}
