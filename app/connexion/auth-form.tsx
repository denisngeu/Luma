"use client";

import { ArrowRight } from "lucide-react";
import { useActionState, useState } from "react";
import { loginOrRegisterAction } from "./actions";

export default function AuthForm({ returnTo }: { returnTo: string }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [state, formAction, isPending] = useActionState(loginOrRegisterAction, undefined);

  return <>
    <div className="auth-tabs" role="tablist" aria-label="Type de connexion">
      <button type="button" role="tab" aria-selected={mode === "login"} onClick={() => setMode("login")}>Se connecter</button>
      <button type="button" role="tab" aria-selected={mode === "register"} onClick={() => setMode("register")}>Créer un compte</button>
    </div>
    <form className="auth-form" action={formAction}>
      <input type="hidden" name="action" value={mode} />
      <input type="hidden" name="returnTo" value={returnTo} />
      {mode === "register" && <label>Nom affiché<input name="name" autoComplete="name" minLength={2} maxLength={60} required placeholder="Votre nom" /></label>}
      <label>Adresse e-mail<input name="email" type="email" autoComplete="email" maxLength={254} required placeholder="vous@exemple.fr" /></label>
      <label>Mot de passe<input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={10} maxLength={128} required placeholder="10 caractères minimum" /></label>
      {state?.error && <p className="auth-error" role="alert">{state.error}</p>}
      <button className="login-primary" type="submit" disabled={isPending}>{isPending ? "Connexion…" : mode === "login" ? "Se connecter" : "Créer mon compte"}<ArrowRight size={19} aria-hidden="true" /></button>
      <p className="login-method">{mode === "login" ? "Votre session restera active pendant 30 jours." : "En créant un compte, vous acceptez les règles du service et la politique de confidentialité."}</p>
    </form>
  </>;
}
