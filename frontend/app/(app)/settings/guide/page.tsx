"use client";

import { useRouter } from "next/navigation";
import AuthGate from "../../../../components/AuthGate";

const Command = ({ children }: { children: React.ReactNode }) => (
  <code className="rounded-md bg-[#F2F4F3] px-2 py-1 text-[13px] font-medium text-saraya-text">{children}</code>
);

export default function GuidePage() {
  const router = useRouter();
  return (
    <AuthGate>
      <div className="app-shell min-h-dvh bg-saraya-bg">
        <header className="sticky top-0 z-10 flex h-16 items-center border-b border-saraya-border bg-saraya-bg px-5">
          <button onClick={() => router.back()} className="flex items-center gap-2 text-[15px] font-medium text-saraya-text" aria-label="Retour">
            <span className="text-[22px] leading-none">←</span><span>Guide d'utilisation</span>
          </button>
        </header>
        <main className="px-5 pb-12 pt-6 text-saraya-text">
          <h1 className="text-[22px] font-semibold">Guide d'utilisation Saraya</h1>
          <p className="mt-2 text-[14px] leading-6 text-saraya-secondary">Ce guide explique le stock, la clôture /recette, les corrections et les analyses disponibles.</p>

          <Guide title="1. Stock">
            <p>Dans <b>Stock</b>, utilisez <b>Ajouter du stock</b> lorsqu'une livraison ou un réapprovisionnement arrive. Indiquez l'article et la quantité réellement ajoutée.</p>
            <p>Saraya conserve l'historique de chaque ajout : quantité avant, quantité ajoutée, quantité après et date. Cet historique sert ensuite à l'analyse du rythme d'approvisionnement.</p>
          </Guide>

          <Guide title="2. Démarrer une recette">
            <p>Dans l'Assistant, envoyez <Command>/recette</Command> avec exactement <b>2 photos</b> :</p>
            <p>1) la feuille <b>SARAYA SHIFT STOCK</b> avec Worker, START, AJOUT, FIN, Cash caisse, Dépense, Staff Salaire et Rami Games ;<br/>2) le ticket/récapitulatif de caisse avec les produits et quantités vendues.</p>
            <p><Command>/recette mock</Command> sert uniquement aux tests locaux sans API OpenAI.</p>
          </Guide>

          <Guide title="3. Vérifier les données extraites">
            <p>Lisez toutes les valeurs affichées avant de continuer. Pour corriger une valeur, écrivez par exemple :</p>
            <p><Command>EAU 0.5L FIN = 47</Command></p>
            <p><Command>MENTHE Qte = 8</Command></p>
            <p>Quand tout est exact, envoyez <Command>CONFIRME DONNÉES</Command>.</p>
          </Guide>

          <Guide title="4. Corrections automatiques">
            <p>Après confirmation des données, Saraya calcule les écarts avec les règles du café. Vous devez décider chaque correction avant l'enregistrement.</p>
            <p><Command>ACCEPTE TOUT</Command> — accepte toutes les corrections proposées.</p>
            <p><Command>ACCEPTE EAU 1.5L</Command> — accepte une correction précise.</p>
            <p><Command>REJETTE EAU 0.5L</Command> — refuse la correction financière de cet article.</p>
            <p><Command>MODIFIE CANNETTE = 2.000</Command> — remplace le montant retenu par votre décision.</p>
            <p>Une correction financière rejetée ne supprime pas la consommation physique du stock.</p>
          </Guide>

          <Guide title="5. Confirmer les corrections">
            <p>Quand aucune décision n'est en attente, envoyez <Command>CONFIRME CORRECTIONS</Command>.</p>
            <p>Le backend recalcule et vérifie les montants puis affiche la recette finale. À ce stade, rien n'est encore enregistré.</p>
          </Guide>

          <Guide title="6. Enregistrement définitif">
            <p>Après vérification de la recette finale, envoyez exactement <Command>OUI ENREGISTRE</Command>.</p>
            <p>Saraya enregistre le shift dans PostgreSQL et retire uniquement la consommation physique : <b>START + AJOUT − FIN</b> du stock principal. Le FIN de la feuille ne remplace jamais le stock principal.</p>
            <p>Cette étape est définitive et protégée contre le double enregistrement.</p>
          </Guide>

          <Guide title="7. Analyses PostgreSQL">
            <p><Command>/analyse</Command> — affiche la liste des commandes.</p>
            <p><Command>/analyse dernier</Command> — dernier shift enregistré.</p>
            <p><Command>/analyse 7j</Command> — résumé des 7 derniers jours. Vous pouvez remplacer 7 par un nombre de 1 à 365.</p>
            <p><Command>/analyse stock</Command> — stock actuel et dernières consommations /recette.</p>
            <p><Command>/analyse approvisionnement</Command> — ajouts manuels des 30 derniers jours, quantité moyenne et rythme entre les ajouts.</p>
            <p><Command>/analyse ventes</Command> — produits les plus vendus.</p>
            <p><Command>/analyse corrections</Command> — corrections automatiques, retenues, rejetées et modifiées.</p>
            <p><Command>/analyse cafe</Command> — cafés vendus, beans consommés et ratio cafés/kg.</p>
            <p><Command>/analyse chicha</Command> — chichas normales/personnel, tombac et ratio g/chicha.</p>
          </Guide>

          <Guide title="8. Assistant avec l'API OpenAI">
            <p>Quand une clé API OpenAI valide et créditée est configurée dans Réglages, l'assistant peut utiliser le contexte Saraya pour répondre naturellement. Le contexte inclut le stock actuel, les mouvements récents et l'historique d'approvisionnement.</p>
            <p>Les commandes /analyse restent disponibles même sans API. Les calculs métier et l'écriture du stock restent contrôlés par Saraya et PostgreSQL.</p>
          </Guide>
        </main>
      </div>
    </AuthGate>
  );
}

function Guide({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mt-7 border-t border-saraya-border pt-5"><h2 className="mb-3 text-[16px] font-semibold">{title}</h2><div className="space-y-3 text-[14px] leading-6">{children}</div></section>;
}
