/**
 * THE LOAD PLAN. Deck, because this is the truck rather than the paperwork.
 *
 * The material contrast is the label in this interface: paper is the
 * regulation and the document, deck is the machine and the vehicle. A vehicle
 * bay rendered on paper would read as a form; rendered on deck it reads as a
 * place where things are physically put.
 *
 * The two toggles are not preferences. `barriersPresent` is an ASSERTION about
 * the physical world that changes what the regulation permits, and PHMSA
 * interpretation 03-0300 is explicit that air space alone does not satisfy it.
 * `singleShipper` gates the only carve-out in 177.848(e)(3). Both are worded
 * so an operator knows they are attesting to something, not choosing a mode.
 */
import { Placard } from "./Placard.tsx";
import type { ResolvedItem } from "../solver/types.ts";
import "./loadplan.css";

/**
 * `key` is a STABLE IDENTITY, not a position. Attestation invalidation compares
 * a bay's contents before and after an edit, and comparing by array index
 * revoked assertions from bays that had only SHIFTED: delete an empty vehicle 2
 * and vehicle 3 slides to index 1, where it is compared against the empty bay
 * that used to be there, so a barrier the operator had genuinely asserted about
 * unchanged contents was cleared and the load went from PASS to REFUSED.
 */
export type Bay = {
  key: string;
  items: ResolvedItem[];
  barriersPresent: boolean;
  singleShipper: boolean;
  nonReactionAsserted: boolean;
};

export type LoadPlanPanelProps = {
  bays: Bay[];
  onAddVehicle: () => void;
  onRemoveVehicle: (i: number) => void;
  onToggle: (i: number, key: "barriersPresent" | "singleShipper" | "nonReactionAsserted", value: boolean) => void;
  onMove: (from: { bay: number; item: number }, toBay: number) => void;
  onPropose: () => void;
  busy: boolean;
};

export function LoadPlanPanel({
  bays, onAddVehicle, onRemoveVehicle, onToggle, onMove, onPropose, busy,
}: LoadPlanPanelProps) {
  return (
    <section className="plan" aria-labelledby="plan-heading">
      <header className="plan__head">
        <div>
          <h2 id="plan-heading" className="plan__title">Load plan</h2>
          <p className="plan__sub">
            {bays.length} {bays.length === 1 ? "vehicle" : "vehicles"}
          </p>
        </div>
        <div className="plan__actions">
          <button type="button" className="pill pill--onDeck" onClick={onAddVehicle}>
            Add vehicle
          </button>
          <button type="button" className="pill pill--solidLight" onClick={onPropose} disabled={busy}>
            {busy ? "Solving" : "Propose a legal split"} <span aria-hidden="true">&#8599;</span>
          </button>
        </div>
      </header>

      <div className="plan__bays">
        {bays.map((bay, bi) => (
          <article key={bi} className="bay" aria-label={`Vehicle ${bi + 1}`}>
            <header className="bay__head">
              <span className="bay__n mono">Vehicle {bi + 1}</span>
              {bays.length > 1 && (
                <button
                  type="button"
                  className="bay__remove"
                  onClick={() => onRemoveVehicle(bi)}
                  aria-label={`Remove vehicle ${bi + 1}`}
                >
                  &times;
                </button>
              )}
            </header>

            <ul className="bay__items">
              {bay.items.length === 0 && <li className="bay__empty">empty</li>}
              {bay.items.map((it, ii) => (
                <li key={`${it.item.id ?? it.name}-${ii}`} className="bay__item">
                  <Placard hazardClass={it.forbidden ? "Forbidden" : it.hazardClass} size={30} />
                  <span className="bay__name">{it.name}</span>
                  {bays.length > 1 && (
                    <label className="bay__moveWrap">
                      <span className="sr-only">Move {it.name} to another vehicle</span>
                      <select
                        className="bay__move mono"
                        value={bi}
                        onChange={(e) => onMove({ bay: bi, item: ii }, Number(e.target.value))}
                      >
                        {bays.map((_, target) => (
                          <option key={target} value={target}>V{target + 1}</option>
                        ))}
                      </select>
                    </label>
                  )}
                </li>
              ))}
            </ul>

            <div className="bay__assertions">
              <label className="bay__check">
                <input
                  type="checkbox"
                  checked={bay.barriersPresent}
                  onChange={(e) => onToggle(bi, "barriersPresent", e.target.checked)}
                />
                <span>
                  Every pair marked O is separated so that if a package leaked in normal
                  transport, the contents could not commingle
                  {/* THE CHECKBOX ASSERTED LESS THAN THE CLAUSE REQUIRES, which is
                      the round-fourteen shape again on a different control. It read
                      "physical barriers separate incompatible items", and a divider
                      satisfies that wording while leaked liquids still meet.
                      177.848(e)(3) asks for separation such that "in the event of
                      leakage from packages under conditions normally incident to
                      transportation, commingling of hazardous materials would not
                      occur", which is a claim about what happens when a drum fails,
                      not about what sits between two drums. */}
                  <em className="bay__hint">
                    177.848(e)(3) is not satisfied by a divider on its own. The separation has to
                    make commingling impossible in the event of leakage under conditions normally
                    incident to transportation, and PHMSA interpretation 03-0300 is explicit that
                    air space alone does not satisfy it. Impediments, dividers or non-hazardous
                    packages are the usual means. Ticking it is an assertion about the loaded
                    vehicle that you carry under 172.204.
                  </em>
                </span>
              </label>
              <label className="bay__check">
                <input
                  type="checkbox"
                  checked={bay.singleShipper}
                  onChange={(e) => onToggle(bi, "singleShipper", e.target.checked)}
                />
                <span>
                  Truckload shipment by a single shipper
                  <em className="bay__hint">
                    Goods from different shippers loaded together are not a truckload shipment.
                  </em>
                </span>
              </label>
              {/* ONE CHECKBOX WAS PROVING TWO DIFFERENT CLAUSES, and they do
                  not say the same thing. It read "will not cause a fire or a
                  dangerous evolution of heat or gas", which is 177.848(e)(3).
                  The solver also accepted it as proof of 177.848(e)(6), whose
                  condition is that the materials "are not capable of reacting
                  dangerously with each other" and so also covers outcomes that
                  are neither fire nor heat nor gas. The narrower assertion was
                  clearing the wider exception.

                  It was also shown only while single shipper was ticked, while
                  its VALUE persisted when it hid. Reproduced: tick both, untick
                  single shipper, and a same-class pair with subsidiary hazards
                  committed a shipping paper on an assertion the operator could
                  no longer see. A hidden control must never hold a live claim,
                  so this asks for both conditions and is always visible. */}
              <label className="bay__check bay__check--grave">
                <input
                  type="checkbox"
                  checked={bay.nonReactionAsserted}
                  onChange={(e) => onToggle(bi, "nonReactionAsserted", e.target.checked)}
                />
                <span>
                  I know these materials cannot react dangerously with each other, and that the
                  mixture will not cause a fire or a dangerous evolution of heat or gas
                  <em className="bay__hint">
                    Two clauses turn on this and they ask different things. 177.848(e)(3) needs the
                    second half, in addition to the truckload above, before its exception applies.
                    177.848(e)(6) needs the first half before a subsidiary hazard can be set aside
                    between materials of the same class. No table decides either. Ticking it is an
                    assertion about the chemistry that you carry under 172.204.
                  </em>
                </span>
              </label>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
