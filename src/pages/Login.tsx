import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import { Activity, FlaskConical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const DEMO_EMAIL = "demo@demo.app";
const DEMO_PASSWORD = "Demo@1234";

const Login = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Se já houver sessão, manda direto pro admin
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        navigate("/admin", { replace: true });
      }
    });
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setIsLoading(false);

    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "E-mail ou senha incorretos."
          : `Erro ao entrar: ${error.message}`
      );
      return;
    }

    toast.success("Login realizado com sucesso!");
    navigate("/admin", { replace: true });
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error("Informe seu e-mail antes de pedir recuperação.");
      return;
    }
    setIsLoading(true);

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/login`,
    });

    setIsLoading(false);

    if (error) {
      toast.error(`Não foi possível enviar: ${error.message}`);
      return;
    }
    toast.success(
      "Se este e-mail estiver cadastrado, você receberá instruções em instantes."
    );
    setForgot(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-health-bg px-4">
      <Card className="w-full max-w-md shadow-medium">
        <CardHeader className="space-y-1 text-center">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <Activity className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Painel Administrativo</CardTitle>
          <CardDescription>
            {forgot
              ? "Informe seu e-mail e enviaremos um link para redefinir a senha."
              : "Entre com seu e-mail e senha cadastrados."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Banner demo */}
          {!forgot && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                <FlaskConical className="h-3.5 w-3.5" />
                Acesso demo — experimente sem cadastro
              </p>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>E-mail: <span className="font-mono text-foreground">{DEMO_EMAIL}</span></p>
                <p>Senha: <span className="font-mono text-foreground">{DEMO_PASSWORD}</span></p>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="w-full h-7 text-xs border-primary/30 hover:bg-primary/10"
                onClick={() => { setEmail(DEMO_EMAIL); setPassword(DEMO_PASSWORD); }}
              >
                Preencher automaticamente
              </Button>
            </div>
          )}

          <form
            onSubmit={forgot ? handleForgotPassword : handleLogin}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </div>
            {!forgot && (
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Sua senha"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
              </div>
            )}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading
                ? "Aguarde..."
                : forgot
                  ? "Enviar link de recuperação"
                  : "Entrar"}
            </Button>
            <button
              type="button"
              className="w-full text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
              onClick={() => setForgot((v) => !v)}
            >
              {forgot ? "Voltar para o login" : "Esqueci minha senha"}
            </button>
          </form>
        </CardContent>
      </Card>

    </div>
  );
};

export default Login;
