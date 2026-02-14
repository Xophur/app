from fastapi import FastAPI, APIRouter, HTTPException, Request
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict
import uuid
from datetime import datetime, timezone
from emergentintegrations.payments.stripe.checkout import (
    StripeCheckout, 
    CheckoutSessionResponse, 
    CheckoutStatusResponse, 
    CheckoutSessionRequest
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Quiz Questions Data
QUESTIONS = [
    # Attachment Section
    {"n": 1, "section": "Attachment", "text": "I worry someone I like will lose interest in me."},
    {"n": 2, "section": "Attachment", "text": "When someone pulls back, I feel a strong urge to fix it right away."},
    {"n": 3, "section": "Attachment", "text": "I need frequent reassurance that we're okay."},
    {"n": 4, "section": "Attachment", "text": "I overthink texts, tone, and timing more than I want to."},
    {"n": 5, "section": "Attachment", "text": "I feel suffocated if someone wants too much closeness."},
    {"n": 6, "section": "Attachment", "text": "When things get serious, I suddenly want more space."},
    {"n": 7, "section": "Attachment", "text": "I prefer solving problems alone rather than leaning on a partner."},
    {"n": 8, "section": "Attachment", "text": "I get uncomfortable with emotional conversations that feel heavy."},
    # Conflict Section
    {"n": 9, "section": "Conflict", "text": "I bring up issues as character flaws (you always, you never)."},
    {"n": 10, "section": "Conflict", "text": "I use sarcasm, eye-roll energy, or put-downs when upset."},
    {"n": 11, "section": "Conflict", "text": "I defend myself fast instead of hearing the point."},
    {"n": 12, "section": "Conflict", "text": "I shut down, go quiet, or leave the conversation mentally/physically."},
    {"n": 13, "section": "Conflict", "text": "I can start conflict gently (complaint + need) instead of attacking.", "reverse": True},
    {"n": 14, "section": "Conflict", "text": "I can accept repair attempts (softening, pause, reset) mid-argument.", "reverse": True},
    {"n": 15, "section": "Conflict", "text": "I escalate once I feel misunderstood."},
    {"n": 16, "section": "Conflict", "text": "After conflict, I struggle to reconnect warmly."},
    # Patterns Section
    {"n": 17, "section": "Patterns", "text": "I ignore red flags because the chemistry is strong."},
    {"n": 18, "section": "Patterns", "text": "I stay longer than I should hoping potential becomes reality."},
    {"n": 19, "section": "Patterns", "text": "I confuse intensity with compatibility."},
    {"n": 20, "section": "Patterns", "text": "I'm drawn to emotionally unavailable people."},
    {"n": 21, "section": "Patterns", "text": "I feel responsible for other people's feelings."},
    {"n": 22, "section": "Patterns", "text": "I struggle to ask directly for what I want."},
    {"n": 23, "section": "Patterns", "text": "I tolerate almost treatment (almost commitment, almost consistency)."},
    {"n": 24, "section": "Patterns", "text": "I test people instead of stating needs (withdraw, jealousy bait, silent treatment, etc.)."},
    {"n": 25, "section": "Patterns", "text": "I pick partners who fit a fantasy rather than my real life needs."},
]

# Fixed price package
QUIZ_PACKAGES = {
    "full_results": 10.00
}

# Define Models
class StatusCheck(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    client_name: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class StatusCheckCreate(BaseModel):
    client_name: str

class QuizAnswers(BaseModel):
    answers: List[int]

class QuizSubmitRequest(BaseModel):
    answers: List[int]
    email: Optional[str] = None

class CheckoutRequest(BaseModel):
    result_id: str
    origin_url: str

class PaymentStatusRequest(BaseModel):
    session_id: str

class EmailResultsRequest(BaseModel):
    result_id: str
    email: str

# Scoring functions
def compute_scores(answers: List[int]) -> Dict:
    ax = sum(answers[0:4])
    av = sum(answers[4:8])
    q13r = 6 - answers[12]
    q14r = 6 - answers[13]
    cr = answers[8] + answers[9] + answers[10] + answers[11] + q13r + q14r + answers[14] + answers[15]
    ps = sum(answers[16:25])
    return {"ax": ax, "av": av, "cr": cr, "ps": ps}

def tag_attachment(score: int) -> str:
    if score >= 14:
        return "High"
    if score >= 10:
        return "Moderate"
    return "Low"

def tag_cr(score: int) -> str:
    if score >= 28:
        return "High"
    if score >= 18:
        return "Moderate"
    return "Low"

def tag_ps(score: int) -> str:
    if score >= 33:
        return "High"
    if score >= 21:
        return "Moderate"
    return "Low"

def attachment_style(ax: int, av: int) -> str:
    ax_high = ax >= 14
    av_high = av >= 14
    if ax_high and not av_high:
        return "Anxious-leaning"
    if not ax_high and av_high:
        return "Avoidant-leaning"
    if ax_high and av_high:
        return "Fearful-avoidant (push-pull)"
    return "More secure-leaning"

def build_blocks(primary: str, volcano: bool, picker: bool) -> Dict:
    base = {
        "The Chaser": {
            "what": "You bond fast and chase clarity when connection feels uncertain. That urgency can pressure the relationship, especially if the other person is inconsistent or emotionally limited.",
            "steps": [
                "Use a 24-hour rule when activated: pause before big texts, decisions, or ultimatums.",
                "Replace reassurance-seeking with one clear ask: Can we talk tonight? I want closeness and clarity.",
                "Date for consistency, not intensity: track follow-through and effort over time."
            ],
            "script": "I'm feeling activated. I want clarity, not a fight. Let's talk when we're both calm."
        },
        "The Escape Artist": {
            "what": "When things get real, you default to distance. Partners feel shut out, and tough conversations become too much, so connection erodes quietly.",
            "steps": [
                "Practice micro-vulnerability daily: one honest sentence instead of disappearing.",
                "Use a scripted pause and return: I'm flooded. I care. I need 30 minutes and I'm coming back.",
                "Turn toward bids for connection: small responses build safety fast."
            ],
            "script": "I'm overwhelmed. I care about us. I'm taking 30 minutes, then I'll come back to repair."
        },
        "The Push-Pull Magnet": {
            "what": "You want closeness and fear it at the same time. You can bond fast, then doubt, then test, then detach. That creates instability even when feelings are real.",
            "steps": [
                "Slow the runway: no major commitments for 6-8 weeks - consistency first.",
                "Replace tests with direct needs: say the need instead of provoking a reaction.",
                "Use gentle start-ups and repair attempts early in conflict."
            ],
            "script": "I want closeness, and I'm getting scared. I'm going to be direct instead of testing."
        },
        "Secure Builder": {
            "what": "You're relatively secure. If things go wrong, it's usually selection (who you pick), timing, or skill mismatch - not your capacity to love.",
            "steps": [
                "State your needs early and watch behavior - not promises.",
                "Keep standards: consistency and repair matter more than chemistry.",
                "If conflict repeats, implement a repair ritual or exit cleanly."
            ],
            "script": "I'm open to working on this - if we can repair and change the pattern."
        }
    }
    
    out = base.get(primary, base["Secure Builder"]).copy()
    out["steps"] = out["steps"].copy()
    
    if picker:
        out["what"] += " You also tend to override your standards when chemistry is strong - then you stay too long hoping potential becomes reality."
        out["steps"].insert(0, "Create 5 non-negotiables and enforce them. Consistency is the gate; potential does not count.")
        out["steps"].append("Use an evidence log: if the same red flag appears twice, you exit - no negotiating with the pattern.")
    
    if volcano:
        out["what"] += " Conflict is the multiplier: arguments escalate, repair gets missed, and disconnection follows."
        out["steps"].insert(0, "Ban the big four in your house: contempt, criticism, defensiveness, stonewalling. Replace with behavior + feeling + need.")
        out["steps"].append("Install a repair protocol: pause, return, name feeling, make one request, agree on one change.")
        out["script"] = "I'm activated. I'm pausing so I don't say something I can't take back. I will come back to repair."
    
    out["steps"] = out["steps"][:6]
    return out

def compute_full_results(answers: List[int]) -> Dict:
    scores = compute_scores(answers)
    ax, av, cr, ps = scores["ax"], scores["av"], scores["cr"], scores["ps"]
    
    attach = attachment_style(ax, av)
    
    primary = "Secure Builder"
    if attach.startswith("Anxious"):
        primary = "The Chaser"
    elif attach.startswith("Avoidant"):
        primary = "The Escape Artist"
    elif attach.startswith("Fearful"):
        primary = "The Push-Pull Magnet"
    
    volcano = cr >= 28
    picker = ps >= 33
    
    mods = []
    if picker:
        mods.append("Pattern Picker")
    if volcano:
        mods.append("Volcano")
    
    label = primary
    if mods:
        label += " + " + " + ".join(mods)
    
    blocks = build_blocks(primary, volcano, picker)
    
    return {
        "scores": {
            "ax": ax,
            "av": av,
            "cr": cr,
            "ps": ps,
            "ax_tag": tag_attachment(ax),
            "av_tag": tag_attachment(av),
            "cr_tag": tag_cr(cr),
            "ps_tag": tag_ps(ps)
        },
        "label": label,
        "primary": primary,
        "mods": mods,
        "attach": attach,
        "volcano": volcano,
        "picker": picker,
        "what": blocks["what"],
        "steps": blocks["steps"],
        "script": blocks["script"]
    }

def compute_teaser_results(answers: List[int]) -> Dict:
    scores = compute_scores(answers)
    ax, av, cr, ps = scores["ax"], scores["av"], scores["cr"], scores["ps"]
    attach = attachment_style(ax, av)
    
    primary = "Secure Builder"
    if attach.startswith("Anxious"):
        primary = "The Chaser"
    elif attach.startswith("Avoidant"):
        primary = "The Escape Artist"
    elif attach.startswith("Fearful"):
        primary = "The Push-Pull Magnet"
    
    volcano = cr >= 28
    picker = ps >= 33
    
    mods = []
    if picker:
        mods.append("Pattern Picker")
    if volcano:
        mods.append("Volcano")
    
    label = primary
    if mods:
        label += " + " + " + ".join(mods)
    
    return {
        "scores": {
            "ax": ax,
            "av": av,
            "cr": cr,
            "ps": ps,
            "ax_tag": tag_attachment(ax),
            "av_tag": tag_attachment(av),
            "cr_tag": tag_cr(cr),
            "ps_tag": tag_ps(ps)
        },
        "label": label,
        "primary": primary,
        "mods": mods,
        "attach": attach,
        "teaser_what": f"As a {primary}, you have specific patterns in how you connect with others...",
        "teaser_tip": "Unlock your full analysis to discover what tends to go wrong and exactly how to improve."
    }

# Routes
@api_router.get("/")
async def root():
    return {"message": "Love Life Debugger API"}

@api_router.get("/quiz/questions")
async def get_questions():
    return {"questions": QUESTIONS}

@api_router.post("/quiz/submit")
async def submit_quiz(request: QuizSubmitRequest):
    if len(request.answers) != 25:
        raise HTTPException(status_code=400, detail="Must provide exactly 25 answers")
    
    if not all(1 <= a <= 5 for a in request.answers):
        raise HTTPException(status_code=400, detail="All answers must be between 1 and 5")
    
    result_id = str(uuid.uuid4())
    teaser = compute_teaser_results(request.answers)
    full = compute_full_results(request.answers)
    
    doc = {
        "id": result_id,
        "answers": request.answers,
        "email": request.email,
        "teaser_results": teaser,
        "full_results": full,
        "is_paid": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.quiz_results.insert_one(doc)
    
    return {
        "result_id": result_id,
        "teaser": teaser,
        "is_paid": False
    }

@api_router.get("/results/{result_id}")
async def get_results(result_id: str):
    result = await db.quiz_results.find_one({"id": result_id}, {"_id": 0})
    
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    if result.get("is_paid"):
        return {
            "result_id": result_id,
            "is_paid": True,
            "results": result["full_results"]
        }
    else:
        return {
            "result_id": result_id,
            "is_paid": False,
            "teaser": result["teaser_results"]
        }

@api_router.post("/checkout/session")
async def create_checkout_session(request: CheckoutRequest, http_request: Request):
    result = await db.quiz_results.find_one({"id": request.result_id}, {"_id": 0})
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    if result.get("is_paid"):
        raise HTTPException(status_code=400, detail="Results already unlocked")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment not configured")
    
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    success_url = f"{request.origin_url}/results/{request.result_id}?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{request.origin_url}/results/{request.result_id}"
    
    checkout_request = CheckoutSessionRequest(
        amount=QUIZ_PACKAGES["full_results"],
        currency="usd",
        success_url=success_url,
        cancel_url=cancel_url,
        metadata={
            "result_id": request.result_id,
            "product": "full_quiz_results"
        }
    )
    
    session = await stripe_checkout.create_checkout_session(checkout_request)
    
    transaction = {
        "id": str(uuid.uuid4()),
        "session_id": session.session_id,
        "result_id": request.result_id,
        "amount": QUIZ_PACKAGES["full_results"],
        "currency": "usd",
        "payment_status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.payment_transactions.insert_one(transaction)
    
    return {"url": session.url, "session_id": session.session_id}

@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, http_request: Request):
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment not configured")
    
    host_url = str(http_request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    status = await stripe_checkout.get_checkout_status(session_id)
    
    await db.payment_transactions.update_one(
        {"session_id": session_id},
        {"$set": {
            "payment_status": status.payment_status,
            "status": status.status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if status.payment_status == "paid":
        transaction = await db.payment_transactions.find_one(
            {"session_id": session_id},
            {"_id": 0}
        )
        if transaction and transaction.get("result_id"):
            result = await db.quiz_results.find_one(
                {"id": transaction["result_id"]},
                {"_id": 0}
            )
            if result and not result.get("is_paid"):
                await db.quiz_results.update_one(
                    {"id": transaction["result_id"]},
                    {"$set": {
                        "is_paid": True,
                        "paid_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
    
    return {
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency
    }

@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    body = await request.body()
    signature = request.headers.get("Stripe-Signature")
    
    api_key = os.environ.get("STRIPE_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="Payment not configured")
    
    host_url = str(request.base_url).rstrip('/')
    webhook_url = f"{host_url}/api/webhook/stripe"
    
    stripe_checkout = StripeCheckout(api_key=api_key, webhook_url=webhook_url)
    
    try:
        webhook_response = await stripe_checkout.handle_webhook(body, signature)
        
        if webhook_response.payment_status == "paid":
            result_id = webhook_response.metadata.get("result_id")
            if result_id:
                await db.quiz_results.update_one(
                    {"id": result_id},
                    {"$set": {
                        "is_paid": True,
                        "paid_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
        
        return {"status": "success"}
    except Exception as e:
        logging.error(f"Webhook error: {e}")
        return {"status": "error", "message": str(e)}

@api_router.post("/results/email")
async def email_results(request: EmailResultsRequest):
    result = await db.quiz_results.find_one({"id": request.result_id}, {"_id": 0})
    
    if not result:
        raise HTTPException(status_code=404, detail="Result not found")
    
    if not result.get("is_paid"):
        raise HTTPException(status_code=403, detail="This feature requires unlocking full results")
    
    await db.quiz_results.update_one(
        {"id": request.result_id},
        {"$set": {"emailed_to": request.email, "emailed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"success": True, "message": f"Results will be sent to {request.email}"}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
