import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Heart,
  Lock,
  Unlock,
  Copy,
  Twitter,
  Facebook,
  Mail,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Zap,
  ArrowRight,
  Loader2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

function ScoreCard({ label, value, maxValue, tag, delay = 0 }) {
  const percentage = (value / maxValue) * 100;
  const tagColor =
    tag === "High" ? "text-rose-400" : tag === "Moderate" ? "text-amber-400" : "text-emerald-400";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
    >
      <Card className="kpi-card bg-black/40 border-white/10">
        <CardContent className="p-4">
          <div className="font-mono text-xs text-muted-foreground mb-2">{label}</div>
          <div className="text-2xl font-bold text-white mb-1">
            {value} <span className="text-muted-foreground text-sm">/ {maxValue}</span>
          </div>
          <div className="mb-2">
            <Progress value={percentage} className="h-1.5 bg-white/10" />
          </div>
          <div className={`text-xs font-medium ${tagColor}`}>{tag}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TypeBadge({ label, mods }) {
  const hasRisk = mods && mods.length > 0;
  const bgColor = hasRisk
    ? "bg-gradient-to-r from-rose-500/20 to-amber-500/20 border-rose-500/30"
    : "bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-emerald-500/30";
  const iconColor = hasRisk ? "text-rose-400" : "text-emerald-400";

  return (
    <div
      className={`inline-flex items-center gap-3 px-5 py-3 rounded-2xl border ${bgColor}`}
    >
      <span className={iconColor}>
        {hasRisk ? <AlertTriangle className="w-5 h-5" /> : <CheckCircle className="w-5 h-5" />}
      </span>
      <span className="font-medium text-white">{label}</span>
    </div>
  );
}

export default function ResultsPage() {
  const { resultId } = useParams();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  const [results, setResults] = useState(null);
  const [isPaid, setIsPaid] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);
  const [isProcessingCheckout, setIsProcessingCheckout] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const fetchResults = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/results/${resultId}`);
      setResults(response.data.is_paid ? response.data.results : response.data.teaser);
      setIsPaid(response.data.is_paid);
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch results:", error);
      toast.error("Failed to load results");
      setIsLoading(false);
    }
  }, [resultId]);

  const pollPaymentStatus = useCallback(async (sid, attempts = 0) => {
    const maxAttempts = 10;
    const pollInterval = 2000;

    if (attempts >= maxAttempts) {
      setIsCheckingPayment(false);
      toast.error("Payment verification timed out. Please refresh the page.");
      return;
    }

    try {
      const response = await axios.get(`${API}/checkout/status/${sid}`);

      if (response.data.payment_status === "paid") {
        setIsCheckingPayment(false);
        toast.success("Payment successful! Unlocking your full analysis...");
        fetchResults();
        return;
      } else if (response.data.status === "expired") {
        setIsCheckingPayment(false);
        toast.error("Payment session expired. Please try again.");
        return;
      }

      setTimeout(() => pollPaymentStatus(sid, attempts + 1), pollInterval);
    } catch (error) {
      console.error("Error checking payment status:", error);
      setIsCheckingPayment(false);
    }
  }, [fetchResults]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  useEffect(() => {
    if (sessionId && !isPaid) {
      setIsCheckingPayment(true);
      pollPaymentStatus(sessionId);
    }
  }, [sessionId, isPaid, pollPaymentStatus]);

  const handleUnlock = async () => {
    setIsProcessingCheckout(true);
    try {
      const originUrl = window.location.origin;
      const response = await axios.post(`${API}/checkout/session`, {
        result_id: resultId,
        origin_url: originUrl,
      });

      if (response.data.url) {
        window.location.href = response.data.url;
      }
    } catch (error) {
      console.error("Failed to create checkout:", error);
      toast.error("Failed to start checkout. Please try again.");
      setIsProcessingCheckout(false);
    }
  };

  const copyToClipboard = async () => {
    const summary = generateShareText();
    try {
      await navigator.clipboard.writeText(summary);
      toast.success("Summary copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy. Please try again.");
    }
  };

  const generateShareText = () => {
    if (!results) return "";

    const lines = [
      "LOVE LIFE DEBUGGER — RESULTS",
      `Type: ${results.label}`,
      `Attachment: ${results.attach}`,
      `AX: ${results.scores.ax}/20 (${results.scores.ax_tag})`,
      `AV: ${results.scores.av}/20 (${results.scores.av_tag})`,
      `CR: ${results.scores.cr}/40 (${results.scores.cr_tag})`,
      `PS: ${results.scores.ps}/45 (${results.scores.ps_tag})`,
    ];

    if (isPaid && results.what) {
      lines.push("", "What tends to go wrong:", results.what);
      if (results.steps) {
        lines.push("", "How to improve:");
        results.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
      }
      if (results.script) {
        lines.push("", "Reset script:", results.script);
      }
    }

    return lines.join("\n");
  };

  const shareOnTwitter = () => {
    const text = encodeURIComponent(
      `I just discovered I'm "${results.label}" in my love life patterns! 💕 Take the Love Life Debugger quiz to find yours.`
    );
    window.open(`https://twitter.com/intent/tweet?text=${text}`, "_blank");
  };

  const shareOnFacebook = () => {
    const url = encodeURIComponent(window.location.href);
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${url}`, "_blank");
  };

  const emailResults = async () => {
    if (!emailInput || !emailInput.includes("@")) {
      toast.error("Please enter a valid email address");
      return;
    }

    setIsSendingEmail(true);
    try {
      await axios.post(`${API}/results/email`, {
        result_id: resultId,
        email: emailInput,
      });
      toast.success(`Results will be sent to ${emailInput}`);
      setEmailInput("");
    } catch (error) {
      toast.error("Failed to send email. Please try again.");
    } finally {
      setIsSendingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Heart className="w-16 h-16 text-rose-500" />
        </motion.div>
      </div>
    );
  }

  if (isCheckingPayment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#050505] px-4">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="mb-6"
        >
          <Loader2 className="w-12 h-12 text-rose-500" />
        </motion.div>
        <h2 className="font-serif text-2xl text-white mb-2">Verifying Payment...</h2>
        <p className="text-muted-foreground">Please wait while we confirm your purchase.</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050505]">
        <p className="text-muted-foreground">Results not found</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] noise-overlay">
      {/* Header */}
      <header className="glass border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Heart className="w-6 h-6 text-rose-500" />
            <h1 className="font-serif text-xl font-semibold text-white">Your Results</h1>
          </div>
          <div className="flex items-center gap-2">
            {isPaid ? (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <Unlock className="w-4 h-4" />
                <span>Full Access</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-amber-400 text-sm">
                <Lock className="w-4 h-4" />
                <span>Limited View</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 pb-32">
        {/* Type Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h2 className="font-serif text-3xl md:text-5xl font-bold text-white mb-4">
            You are: <span className="text-rose-400">{results.primary}</span>
          </h2>
          <TypeBadge label={results.label} mods={results.mods} />
          <p className="mt-4 text-muted-foreground max-w-xl mx-auto">
            Attachment style: <span className="text-white">{results.attach}</span>
          </p>
        </motion.div>

        {/* Score Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <ScoreCard
            label="AX (Anxious)"
            value={results.scores.ax}
            maxValue={20}
            tag={results.scores.ax_tag}
            delay={0.1}
          />
          <ScoreCard
            label="AV (Avoidant)"
            value={results.scores.av}
            maxValue={20}
            tag={results.scores.av_tag}
            delay={0.2}
          />
          <ScoreCard
            label="CR (Conflict Risk)"
            value={results.scores.cr}
            maxValue={40}
            tag={results.scores.cr_tag}
            delay={0.3}
          />
          <ScoreCard
            label="PS (Pattern Score)"
            value={results.scores.ps}
            maxValue={45}
            tag={results.scores.ps_tag}
            delay={0.4}
          />
        </div>

        {/* Full Results or Unlock CTA */}
        {isPaid ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-6"
          >
            {/* What Goes Wrong */}
            <Card className="bg-black/40 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-rose-400 font-serif">
                  <AlertTriangle className="w-5 h-5" />
                  What Tends to Go Wrong
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-white/90 leading-relaxed">{results.what}</p>
              </CardContent>
            </Card>

            {/* How to Improve */}
            <Card className="bg-black/40 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-emerald-400 font-serif">
                  <TrendingUp className="w-5 h-5" />
                  How to Improve (Do This Next)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {results.steps.map((step, idx) => (
                    <li key={idx} className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 flex items-center justify-center text-sm font-medium">
                        {idx + 1}
                      </span>
                      <span className="text-white/90">{step}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Reset Script */}
            <Card className="bg-black/40 border-white/10">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-amber-400 font-serif">
                  <Zap className="w-5 h-5" />
                  One-Sentence Reset Script
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="font-mono text-white/90 bg-black/30 p-4 rounded-xl border border-white/5">
                  {results.script}
                </p>
              </CardContent>
            </Card>

            {/* Share Section */}
            <Card className="bg-black/40 border-white/10">
              <CardHeader>
                <CardTitle className="font-serif text-white">Share Your Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={copyToClipboard}
                    variant="outline"
                    className="share-btn border-white/20 hover:bg-white/5"
                    data-testid="copy-results-btn"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Summary
                  </Button>
                  <Button
                    onClick={shareOnTwitter}
                    className="share-btn bg-[#1DA1F2] hover:bg-[#1a8cd8] text-white"
                    data-testid="share-twitter-btn"
                  >
                    <Twitter className="w-4 h-4" />
                    Twitter
                  </Button>
                  <Button
                    onClick={shareOnFacebook}
                    className="share-btn bg-[#4267B2] hover:bg-[#365899] text-white"
                    data-testid="share-facebook-btn"
                  >
                    <Facebook className="w-4 h-4" />
                    Facebook
                  </Button>
                </div>

                <div className="flex gap-2">
                  <Input
                    type="email"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    className="bg-black/30 border-white/10 text-white"
                    data-testid="email-input"
                  />
                  <Button
                    onClick={emailResults}
                    disabled={isSendingEmail}
                    className="bg-rose-600 hover:bg-rose-500"
                    data-testid="send-email-btn"
                  >
                    {isSendingEmail ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        Send
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* Locked Content Preview */
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="relative"
          >
            {/* Teaser Content */}
            <Card className="bg-black/40 border-white/10 mb-6">
              <CardContent className="p-6">
                <p className="text-white/90 text-lg">{results.teaser_what}</p>
                <p className="text-rose-400 mt-3 font-medium">{results.teaser_tip}</p>
              </CardContent>
            </Card>

            {/* Blurred Preview */}
            <div className="relative">
              <div className="locked-blur space-y-4">
                <Card className="bg-black/40 border-white/10">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold mb-3">What Tends to Go Wrong</h3>
                    <p>Lorem ipsum dolor sit amet consectetur adipisicing elit. Quisquam voluptates...</p>
                  </CardContent>
                </Card>
                <Card className="bg-black/40 border-white/10">
                  <CardContent className="p-6">
                    <h3 className="text-xl font-semibold mb-3">How to Improve</h3>
                    <ul className="space-y-2">
                      <li>1. Step one detailed advice here...</li>
                      <li>2. Step two detailed advice here...</li>
                      <li>3. Step three detailed advice here...</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>

              {/* Unlock CTA Overlay */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-[#050505] via-transparent to-transparent">
                <Card className="bg-black/80 border-rose-500/30 glow-rose max-w-md mx-4">
                  <CardContent className="p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-rose-500/20 flex items-center justify-center mx-auto mb-4">
                      <Sparkles className="w-8 h-8 text-rose-400" />
                    </div>
                    <h3 className="font-serif text-2xl font-bold text-white mb-2">
                      Unlock Your Full Analysis
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      Get detailed insights on what's going wrong, personalized steps to improve, 
                      and your reset script — plus sharing options.
                    </p>
                    <div className="text-3xl font-bold text-white mb-4">$10</div>
                    <Button
                      onClick={handleUnlock}
                      disabled={isProcessingCheckout}
                      className="w-full bg-rose-600 hover:bg-rose-500 text-white py-6 rounded-xl font-medium text-lg transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(225,29,72,0.4)]"
                      data-testid="unlock-results-btn"
                    >
                      {isProcessingCheckout ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin mr-2" />
                          Processing...
                        </>
                      ) : (
                        <>
                          Unlock Full Results
                          <ArrowRight className="w-5 h-5 ml-2" />
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-4">
                      Secure payment via Stripe
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Free Copy Option */}
            <div className="mt-8 text-center">
              <Button
                onClick={copyToClipboard}
                variant="outline"
                className="border-white/20 hover:bg-white/5"
                data-testid="copy-teaser-btn"
              >
                <Copy className="w-4 h-4 mr-2" />
                Copy Basic Summary (Free)
              </Button>
            </div>
          </motion.div>
        )}

        {/* Safety Note */}
        <div className="mt-10 p-4 rounded-xl border border-white/10 bg-black/20">
          <p className="text-sm text-muted-foreground text-center">
            <strong className="text-white">Safety note:</strong> If there's abuse, coercion, or fear, 
            prioritize safety and support—not better communication.
          </p>
        </div>
      </main>
    </div>
  );
}
