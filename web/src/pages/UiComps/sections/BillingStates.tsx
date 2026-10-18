import { useState } from "react";

import { CreditsWidget } from "@/src/components/CreditsWidget";
import { RadioGroup } from "@/src/components/ui/checkbox";
import { billingKeys } from "@/src/features/billing/api";
import { PackCard } from "@/src/features/billing/PackCard";
import { SpendSplitCard } from "@/src/features/billing/SpendSplitCard";

import { Row, Section, Spec } from "../frame";
import { balance, PACKS } from "../fixtures";
import { MockScope } from "../scope";

export function BillingStates() {
  const [pack, setPack] = useState(PACKS[1]!.id);
  return (
    <Section id="billing" eyebrow="screens · billing & account" title="Billing">
      <Spec label="Credits widget · loading, normal, low, empty">
        <Row>
          <MockScope seed={(client) => client.removeQueries({ queryKey: billingKeys.balance })}>
            <CreditsWidget />
          </MockScope>
          <MockScope>
            <CreditsWidget />
          </MockScope>
          <MockScope seed={(client) => client.setQueryData(billingKeys.balance, balance(4))}>
            <CreditsWidget />
          </MockScope>
          <MockScope seed={(client) => client.setQueryData(billingKeys.balance, balance(0))}>
            <CreditsWidget />
          </MockScope>
        </Row>
      </Spec>
      <Spec wide label="Credit packs">
        <RadioGroup value={pack} onValueChange={setPack} className="grid grid-cols-3 gap-3">
          {PACKS.map((p, i) => (
            <PackCard key={p.id} pack={p} selected={p.id === pack} tag={i === 1 ? "Most picked" : undefined} />
          ))}
        </RadioGroup>
      </Spec>
      <Spec wide label="Credit packs · compact (modal)">
        <RadioGroup value={pack} onValueChange={setPack} className="grid grid-cols-3 gap-2">
          {PACKS.map((p) => (
            <PackCard key={p.id} pack={p} selected={p.id === pack} compact />
          ))}
        </RadioGroup>
      </Spec>
      <Spec wide label="Spend split · loading">
        <MockScope seed={(client) => client.removeQueries({ queryKey: billingKeys.spend })}>
          <SpendSplitCard />
        </MockScope>
      </Spec>
      <Spec wide label="Spend split · loaded">
        <MockScope>
          <SpendSplitCard />
        </MockScope>
      </Spec>
    </Section>
  );
}
