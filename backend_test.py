#!/usr/bin/env python3
import requests
import json
import sys
import uuid
from datetime import datetime

class LoveLifeDebuggerTester:
    def __init__(self):
        self.base_url = "https://personality-love-app.preview.emergentagent.com/api"
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})
        
        self.tests_run = 0
        self.tests_passed = 0
        self.result_id = None
        self.session_id = None
        
        # Test answers - valid 1-5 scale answers for all 25 questions
        self.test_answers = [4, 3, 2, 5, 1, 2, 3, 4, 1, 3, 4, 2, 1, 5, 4, 3, 2, 4, 3, 2, 5, 1, 3, 4, 2]
    
    def log_test(self, name, passed, details=""):
        """Log test result"""
        self.tests_run += 1
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {name}")
        if details:
            print(f"    {details}")
        if passed:
            self.tests_passed += 1
    
    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = self.session.get(f"{self.base_url}/")
            passed = response.status_code == 200
            data = response.json() if passed else {}
            self.log_test("API Root", passed, 
                         f"Status: {response.status_code}, Message: {data.get('message', 'N/A')}")
            return passed
        except Exception as e:
            self.log_test("API Root", False, f"Exception: {e}")
            return False
    
    def test_get_questions(self):
        """Test getting quiz questions"""
        try:
            response = self.session.get(f"{self.base_url}/quiz/questions")
            passed = False
            
            if response.status_code == 200:
                data = response.json()
                questions = data.get('questions', [])
                
                # Validate questions structure
                if len(questions) == 25:
                    # Check first few questions have required fields
                    first_q = questions[0]
                    has_required_fields = all(k in first_q for k in ['n', 'section', 'text'])
                    passed = has_required_fields
                    
                    self.log_test("Get Questions", passed, 
                                 f"Status: {response.status_code}, Questions: {len(questions)}")
                else:
                    self.log_test("Get Questions", False, 
                                 f"Expected 25 questions, got {len(questions)}")
            else:
                self.log_test("Get Questions", False, f"Status: {response.status_code}")
                
            return passed
        except Exception as e:
            self.log_test("Get Questions", False, f"Exception: {e}")
            return False
    
    def test_submit_quiz_invalid(self):
        """Test quiz submission with invalid data"""
        try:
            # Test with wrong number of answers
            response = self.session.post(f"{self.base_url}/quiz/submit", 
                                       json={"answers": [1, 2, 3]})  # Only 3 answers
            passed = response.status_code == 400
            self.log_test("Submit Quiz (Invalid - Wrong Count)", passed, 
                         f"Status: {response.status_code}")
            
            # Test with out of range answers
            invalid_answers = [6] * 25  # All 6s (out of 1-5 range)
            response = self.session.post(f"{self.base_url}/quiz/submit", 
                                       json={"answers": invalid_answers})
            passed = response.status_code == 400
            self.log_test("Submit Quiz (Invalid - Out of Range)", passed, 
                         f"Status: {response.status_code}")
            
            return True
        except Exception as e:
            self.log_test("Submit Quiz (Invalid)", False, f"Exception: {e}")
            return False
    
    def test_submit_quiz_valid(self):
        """Test valid quiz submission"""
        try:
            response = self.session.post(f"{self.base_url}/quiz/submit", 
                                       json={"answers": self.test_answers})
            passed = False
            
            if response.status_code == 200:
                data = response.json()
                
                # Check required fields in response
                required_fields = ['result_id', 'teaser', 'is_paid']
                if all(field in data for field in required_fields):
                    self.result_id = data['result_id']
                    
                    # Validate teaser structure
                    teaser = data['teaser']
                    teaser_fields = ['scores', 'label', 'primary', 'attach']
                    if all(field in teaser for field in teaser_fields):
                        passed = True
                        self.log_test("Submit Quiz (Valid)", passed, 
                                     f"Status: {response.status_code}, Result ID: {self.result_id[:8]}...")
                    else:
                        self.log_test("Submit Quiz (Valid)", False, 
                                     f"Missing teaser fields: {teaser_fields}")
                else:
                    self.log_test("Submit Quiz (Valid)", False, 
                                 f"Missing response fields: {required_fields}")
            else:
                self.log_test("Submit Quiz (Valid)", False, f"Status: {response.status_code}")
                
            return passed
        except Exception as e:
            self.log_test("Submit Quiz (Valid)", False, f"Exception: {e}")
            return False
    
    def test_get_results_unpaid(self):
        """Test getting results for unpaid user"""
        if not self.result_id:
            self.log_test("Get Results (Unpaid)", False, "No result_id available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/results/{self.result_id}")
            passed = False
            
            if response.status_code == 200:
                data = response.json()
                
                # Should return teaser for unpaid user
                if not data.get('is_paid', True) and 'teaser' in data:
                    passed = True
                    self.log_test("Get Results (Unpaid)", passed, 
                                 f"Status: {response.status_code}, Is Paid: {data.get('is_paid')}")
                else:
                    self.log_test("Get Results (Unpaid)", False, 
                                 f"Expected teaser for unpaid user")
            else:
                self.log_test("Get Results (Unpaid)", False, f"Status: {response.status_code}")
                
            return passed
        except Exception as e:
            self.log_test("Get Results (Unpaid)", False, f"Exception: {e}")
            return False
    
    def test_get_results_invalid_id(self):
        """Test getting results with invalid ID"""
        try:
            invalid_id = str(uuid.uuid4())
            response = self.session.get(f"{self.base_url}/results/{invalid_id}")
            passed = response.status_code == 404
            self.log_test("Get Results (Invalid ID)", passed, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test("Get Results (Invalid ID)", False, f"Exception: {e}")
            return False
    
    def test_create_checkout_session(self):
        """Test creating Stripe checkout session"""
        if not self.result_id:
            self.log_test("Create Checkout Session", False, "No result_id available")
            return False
            
        try:
            payload = {
                "result_id": self.result_id,
                "origin_url": "https://personality-love-app.preview.emergentagent.com"
            }
            response = self.session.post(f"{self.base_url}/checkout/session", json=payload)
            passed = False
            
            if response.status_code == 200:
                data = response.json()
                if 'url' in data and 'session_id' in data:
                    self.session_id = data['session_id']
                    passed = True
                    self.log_test("Create Checkout Session", passed, 
                                 f"Status: {response.status_code}, Session ID: {self.session_id[:8]}...")
                else:
                    self.log_test("Create Checkout Session", False, 
                                 "Missing 'url' or 'session_id' in response")
            else:
                self.log_test("Create Checkout Session", False, f"Status: {response.status_code}")
                
            return passed
        except Exception as e:
            self.log_test("Create Checkout Session", False, f"Exception: {e}")
            return False
    
    def test_checkout_status(self):
        """Test getting checkout status"""
        if not self.session_id:
            self.log_test("Checkout Status", False, "No session_id available")
            return False
            
        try:
            response = self.session.get(f"{self.base_url}/checkout/status/{self.session_id}")
            passed = False
            
            if response.status_code == 200:
                data = response.json()
                required_fields = ['status', 'payment_status']
                if all(field in data for field in required_fields):
                    passed = True
                    self.log_test("Checkout Status", passed, 
                                 f"Status: {response.status_code}, Payment: {data['payment_status']}")
                else:
                    self.log_test("Checkout Status", False, 
                                 f"Missing fields: {required_fields}")
            else:
                self.log_test("Checkout Status", False, f"Status: {response.status_code}")
                
            return passed
        except Exception as e:
            self.log_test("Checkout Status", False, f"Exception: {e}")
            return False
    
    def test_email_results_unpaid(self):
        """Test emailing results for unpaid user (should fail)"""
        if not self.result_id:
            self.log_test("Email Results (Unpaid)", False, "No result_id available")
            return False
            
        try:
            payload = {
                "result_id": self.result_id,
                "email": "test@example.com"
            }
            response = self.session.post(f"{self.base_url}/results/email", json=payload)
            passed = response.status_code == 403  # Should be forbidden for unpaid
            self.log_test("Email Results (Unpaid)", passed, f"Status: {response.status_code}")
            return passed
        except Exception as e:
            self.log_test("Email Results (Unpaid)", False, f"Exception: {e}")
            return False
    
    def run_all_tests(self):
        """Run all backend tests"""
        print("🚀 Starting Love Life Debugger Backend Tests")
        print("=" * 50)
        
        tests = [
            self.test_api_root,
            self.test_get_questions,
            self.test_submit_quiz_invalid,
            self.test_submit_quiz_valid,
            self.test_get_results_unpaid,
            self.test_get_results_invalid_id,
            self.test_create_checkout_session,
            self.test_checkout_status,
            self.test_email_results_unpaid
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ FAIL - {test.__name__} threw exception: {e}")
                self.tests_run += 1
        
        print("\n" + "=" * 50)
        print(f"📊 Backend Test Summary:")
        print(f"   Tests Run: {self.tests_run}")
        print(f"   Tests Passed: {self.tests_passed}")
        print(f"   Success Rate: {(self.tests_passed/self.tests_run)*100:.1f}%")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All backend tests passed!")
            return 0
        else:
            print("⚠️  Some backend tests failed")
            return 1

def main():
    tester = LoveLifeDebuggerTester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())