import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, ChevronRight, RotateCcw, Sparkles, Lock, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const SCALE_OPTIONS = [
  { value: 1, label: "Strongly disagree" },
  { value: 2, label: "Disagree" },
  { value: 3, label: "Sometimes" },
  { value: 4, label: "Agree" },
  { value: 5, label: "Strongly agree" },
];

export default function QuizPage() {
  const navigate = useNavigate();
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentSection, setCurrentSection] = useState(null);

  useEffect(() => {
    fetchQuestions();
  }, []);

  const fetchQuestions = async () => {
    try {
      const response = await axios.get(`${API}/quiz/questions`);
      setQuestions(response.data.questions);
      setAnswers(new Array(response.data.questions.length).fill(null));
      setIsLoading(false);
    } catch (error) {
      console.error("Failed to fetch questions:", error);
      toast.error("Failed to load quiz questions");
      setIsLoading(false);
    }
  };

  const setAnswer = (index, value) => {
    const newAnswers = [...answers];
    newAnswers[index] = value;
    setAnswers(newAnswers);
  };

  const answeredCount = answers.filter((a) => a !== null).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;
  const canSubmit = answeredCount === questions.length;

  const resetQuiz = () => {
    setAnswers(new Array(questions.length).fill(null));
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast.success("Quiz reset! Start fresh.");
  };

  const submitQuiz = async () => {
    if (!canSubmit) {
      toast.error("Please answer all questions before submitting");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axios.post(`${API}/quiz/submit`, { answers });
      toast.success("Quiz completed! Analyzing your patterns...");
      navigate(`/results/${response.data.result_id}`);
    } catch (error) {
      console.error("Failed to submit quiz:", error);
      toast.error("Failed to submit quiz. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const groupedQuestions = questions.reduce((acc, q, idx) => {
    if (!acc[q.section]) {
      acc[q.section] = [];
    }
    acc[q.section].push({ ...q, index: idx });
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <Heart className="w-16 h-16 text-rose-500" />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen hero-bg">
      {/* Header */}
      <header className="sticky top-0 z-40 glass border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Heart className="w-6 h-6 text-rose-500 heart-pulse" />
              <h1 className="font-serif text-xl font-semibold text-white">
                Love Life Debugger
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="font-mono text-sm text-muted-foreground">
                {answeredCount} / {questions.length}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={resetQuiz}
                className="text-muted-foreground hover:text-white"
                data-testid="reset-quiz-btn"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
            </div>
          </div>
          <div className="mt-3">
            <Progress value={progress} className="h-2 bg-white/10" />
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 md:py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 text-sm font-mono mb-6">
              <Sparkles className="w-4 h-4" />
              25 Questions • 5 Minutes • Deep Insights
            </div>
            <h2 className="font-serif text-4xl md:text-6xl font-bold text-white mb-4 leading-tight">
              What's Really Going Wrong<br />
              <span className="text-rose-400">In Your Love Life?</span>
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Answer honestly using the 1-5 scale. You'll get a pattern diagnosis: 
              what tends to go wrong and a practical plan to improve it.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Quiz Section */}
      <main className="pb-32 px-4">
        <div className="max-w-3xl mx-auto">
          {Object.entries(groupedQuestions).map(([section, sectionQuestions], sectionIdx) => (
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: sectionIdx * 0.1 }}
              className="mb-8"
            >
              {/* Section Header */}
              <div className="flex items-center gap-3 mb-6">
                <div className="section-badge text-rose-300">
                  <span>{section}</span>
                </div>
                <div className="flex-1 h-px bg-gradient-to-r from-rose-500/30 to-transparent" />
              </div>

              {/* Questions */}
              <div className="space-y-4">
                {sectionQuestions.map((q) => (
                  <Card
                    key={q.n}
                    className="bg-black/40 border-white/10 hover:border-rose-500/30 transition-colors"
                    data-testid={`question-card-${q.n}`}
                  >
                    <CardContent className="p-5">
                      <div className="flex gap-4 mb-4">
                        <span className="font-mono text-rose-500/70 text-sm w-8 flex-shrink-0">
                          {q.n})
                        </span>
                        <p className="text-white/90 leading-relaxed">
                          {q.text}
                          {q.reverse && (
                            <span className="text-xs text-muted-foreground ml-2">
                              (reverse scored)
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Scale Options */}
                      <div className="grid grid-cols-5 gap-2 ml-12">
                        {SCALE_OPTIONS.map((opt) => (
                          <button
                            key={opt.value}
                            onClick={() => setAnswer(q.index, opt.value)}
                            className={`scale-option p-3 rounded-xl border text-center cursor-pointer transition-all ${
                              answers[q.index] === opt.value
                                ? "selected border-rose-500/50 bg-rose-500/15"
                                : "border-white/10 bg-black/20 hover:border-white/20"
                            }`}
                            data-testid={`question-${q.n}-option-${opt.value}`}
                          >
                            <span className="block text-lg font-semibold text-white mb-1">
                              {opt.value}
                            </span>
                            <span className="block text-[10px] text-muted-foreground leading-tight">
                              {opt.label}
                            </span>
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </main>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 glass border-t border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {canSubmit ? (
              <div className="flex items-center gap-2 text-emerald-400">
                <Unlock className="w-4 h-4" />
                <span className="text-sm font-medium">Ready to submit</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Lock className="w-4 h-4" />
                <span className="text-sm">
                  {questions.length - answeredCount} questions remaining
                </span>
              </div>
            )}
          </div>
          <Button
            onClick={submitQuiz}
            disabled={!canSubmit || isSubmitting}
            className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-6 rounded-full font-medium transition-all hover:scale-105 hover:shadow-[0_0_30px_rgba(225,29,72,0.4)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
            data-testid="submit-quiz-btn"
          >
            {isSubmitting ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="mr-2"
                >
                  <Heart className="w-5 h-5" />
                </motion.div>
                Analyzing...
              </>
            ) : (
              <>
                See My Results
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
