export default function TermsOfService() {
  return (
    <div>
      {/* Page Hero */}
      <div className="rsf-page-canopy px-4 py-12">
        <div className="mx-auto max-w-4xl">
          <span className="rsf-kicker mb-4">Legal</span>
          <h1 className="mt-3 font-display text-4xl font-bold text-[#F1F5FA]">Terms of Service</h1>
          <p className="mt-2 text-sm text-[#91a8c3]">Last Updated: November 8, 2024</p>
        </div>
      </div>

      {/* Content */}
      <div className="rsf-metal-section px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="rsf-metal-panel rounded-[1.2rem] p-8 md:p-10">
            <div className="space-y-0">

              <section className="pb-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">1. Agreement to Terms</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Welcome to Ready Set Fly. These Terms of Service (&quot;Terms&quot;) govern your access to and use of our
                  aviation marketplace and rental platform, including our website at readysetfly.us and our mobile
                  application (collectively, the &quot;Platform&quot;).
                </p>
                <p className="mt-3 leading-relaxed text-[#E8EDF4]">
                  By accessing or using the Platform, you agree to be bound by these Terms and our Privacy Policy.
                  If you do not agree to these Terms, you may not access or use the Platform.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">2. Eligibility</h2>
                <p className="leading-relaxed text-[#E8EDF4]">You must meet the following requirements to use the Platform:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    { text: "You must be a resident of the United States", strong: true },
                    { text: "You must be at least 18 years old" },
                    { text: "You must have the legal capacity to enter into binding contracts" },
                    { text: "You must not be prohibited from using the Platform under applicable laws" },
                    { text: "To rent aircraft or list aircraft for rent, you must hold valid pilot certificates and/or aircraft ownership documentation as required by law" },
                  ].map(({ text, strong }) => (
                    <li key={text} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span className={strong ? "font-semibold text-[#F1F5FA]" : ""}>{text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  Ready Set Fly is exclusively available to United States residents. By using the Platform, you
                  represent and warrant that you are located in and are a resident of the United States.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">3. Account Registration and Security</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">3.1 Account Creation</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  To use certain features of the Platform, you must create an account. You agree to provide accurate,
                  current, and complete information during registration and to update such information to keep it
                  accurate, current, and complete.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">3.2 Account Security</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You are responsible for maintaining the confidentiality of your account credentials and for all
                  activities that occur under your account. You agree to:
                </p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Use a strong, unique password",
                    "Not share your password with others",
                    "Immediately notify us of any unauthorized use of your account",
                    "Take reasonable precautions to prevent unauthorized access",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">3.3 Account Verification</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We may require you to verify your identity by providing pilot certificates, aircraft ownership
                  documents, insurance information, or other documentation. Failure to provide requested verification
                  may result in account suspension or limitations on Platform features.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">4. Platform Services</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">4.1 Aircraft Rentals</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Ready Set Fly provides a platform connecting aircraft owners with pilots seeking to rent aircraft.
                  We are not a party to rental agreements between owners and renters. All rental agreements are
                  directly between the owner and renter.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">4.2 Marketplace</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Our marketplace allows users to list and browse various aviation-related items and services,
                  including aircraft for sale, CFI services, job postings, flight schools, mechanics, and charter
                  services. We do not guarantee the accuracy, quality, safety, or legality of any marketplace listings.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">4.3 Messaging</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  The Platform provides messaging functionality to facilitate communication between users. You agree
                  to use messaging only for legitimate Platform-related purposes and not for spam, harassment, or
                  illegal activities.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">5. Fees and Payments</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">5.1 Platform Fees for Aircraft Rentals</h3>
                <p className="leading-relaxed text-[#E8EDF4]">Ready Set Fly charges the following fees for aircraft rental transactions:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    { label: "Renter Booking Fee:", text: "7.5% of the total rental amount" },
                    { label: "Owner Commission:", text: "7.5% deducted from owner payout" },
                    { label: "Sales Tax:", text: "8.25% on all rental amounts and booking fees" },
                    { label: "Credit Card Processing Fee:", text: "3% to cover payment processing costs" },
                  ].map(({ label, text }) => (
                    <li key={label} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span><strong className="text-[#F1F5FA]">{label}</strong> {text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  <strong className="text-[#F1F5FA]">Example:</strong> For a $1,000 rental, the renter pays $1,000 (base rental) + $75 (7.5% booking fee) +
                  $88.69 (8.25% sales tax on $1,075) + $34.91 (3% CC processing fee) = <strong className="text-[#F1F5FA]">$1,198.60 total</strong>.
                  The owner receives $925 after the 7.5% platform commission is deducted.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">5.2 Marketplace Listing Fees</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Marketplace listings require a monthly subscription fee based on the listing category and tier.
                  All prices include 8.25% sales tax:
                </p>
                <p className="mt-4 text-sm font-semibold text-[#F1F5FA]">Aircraft for Sale (3 tier options):</p>
                <ul className="mt-2 space-y-2 pl-5">
                  {[
                    { label: "Basic Tier:", text: "$25/month + tax = $27.06/month" },
                    { label: "Standard Tier:", text: "$40/month + tax = $43.30/month" },
                    { label: "Premium Tier:", text: "$100/month + tax = $108.25/month" },
                  ].map(({ label, text }) => (
                    <li key={label} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span><strong className="text-[#F1F5FA]">{label}</strong> {text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-sm font-semibold text-[#F1F5FA]">Other Categories (fixed monthly fees):</p>
                <ul className="mt-2 space-y-2 pl-5">
                  {[
                    { label: "CFI Listings:", text: "$30/month + tax = $32.48/month" },
                    { label: "Job Postings:", text: "$40/month + tax = $43.30/month" },
                    { label: "Flight School Listings:", text: "$250/month + tax = $270.63/month" },
                    { label: "Mechanic Services:", text: "$40/month + tax = $43.30/month" },
                    { label: "Charter Services:", text: "$250/month + tax = $270.63/month" },
                  ].map(({ label, text }) => (
                    <li key={label} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span><strong className="text-[#F1F5FA]">{label}</strong> {text}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  Listings are automatically renewed monthly unless you cancel your subscription. You are responsible
                  for canceling before the renewal date to avoid being charged for the next billing period. Promotional
                  codes may be available for limited-time free trials or discounts.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">5.3 Payment Processing</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  All payments are processed through PayPal Business/Commerce, a trusted global payments platform and our exclusive payment processor. You agree to comply
                  with PayPal Business/Commerce&apos;s terms of service. We do not store your complete payment card information. Only credit
                  card payments are accepted (Pay Later options are disabled for compliance and security).
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">5.4 Owner Withdrawals</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Aircraft owners can request withdrawals of their rental earnings via PayPal Business/Commerce, a trusted global payments platform. Withdrawals are
                  processed using the PayPal Business/Commerce Payouts API and are typically completed within 1–3 business days.
                  Minimum withdrawal amount may apply.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">5.5 Refunds</h3>
                <p className="leading-relaxed text-[#E8EDF4]">Refund eligibility is determined by the specific circumstances of each transaction:</p>
                <ul className="mt-3 space-y-3 pl-5">
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Rental Refunds:</strong> Subject to the cancellation policy agreed upon between owner
                      and renter. <strong className="text-[#F1F5FA]">No refunds will be issued for weather-related cancellations.</strong> Ready Set Fly
                      is not responsible for weather or weather-related cancellations. Platform fees are non-refundable under
                      all circumstances.
                    </span>
                  </li>
                  <li className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                    <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                    <span>
                      <strong className="text-[#F1F5FA]">Marketplace Listing Fees:</strong> Non-refundable. You may cancel at any time to prevent
                      future charges.
                    </span>
                  </li>
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">5.6 Fee Changes</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We reserve the right to change our fees at any time. We will provide at least 30 days&apos; notice of
                  fee increases by email and/or prominent notice on the Platform. Your continued use of the Platform
                  after fee changes take effect constitutes acceptance of the new fees.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">6. User Responsibilities</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">6.1 Aircraft Owners</h3>
                <p className="leading-relaxed text-[#E8EDF4]">If you list aircraft for rent, you represent and warrant that:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "You have legal authority to rent the aircraft",
                    "The aircraft is airworthy and properly maintained",
                    "You carry adequate insurance coverage",
                    "All required certificates and documentation are current and valid",
                    "Your listing information is accurate and complete",
                    "You will comply with all applicable aviation regulations and laws",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">6.2 Renters</h3>
                <p className="leading-relaxed text-[#E8EDF4]">If you rent aircraft, you represent and warrant that:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "You hold all required pilot certificates and ratings",
                    "Your certificates and medical are current and valid",
                    "You are legally permitted to operate the aircraft",
                    "You will comply with all applicable aviation regulations and laws",
                    "You will operate the aircraft safely and responsibly",
                    "You will pay all rental fees and charges on time",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">6.3 All Users</h3>
                <p className="leading-relaxed text-[#E8EDF4]">All users agree to:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Provide accurate and truthful information",
                    "Not impersonate others or misrepresent your identity",
                    "Not engage in fraudulent, deceptive, or illegal activities",
                    "Not harass, threaten, or abuse other users",
                    "Not violate the intellectual property rights of others",
                    "Comply with all applicable laws and regulations",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">7. Prohibited Conduct</h2>
                <p className="leading-relaxed text-[#E8EDF4]">You may not:</p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Use the Platform for any illegal purpose",
                    "Violate any local, state, national, or international law",
                    "Interfere with or disrupt the Platform or servers",
                    "Attempt to gain unauthorized access to the Platform or other user accounts",
                    "Transmit viruses, malware, or other harmful code",
                    "Collect or harvest user information without consent",
                    "Use automated systems (bots, scrapers) to access the Platform",
                    "Circumvent security features or access controls",
                    "Post false, misleading, or fraudulent content",
                    "Engage in price manipulation or other anti-competitive behavior",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">8. Content and Intellectual Property</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">8.1 Your Content</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You retain ownership of all content you post on the Platform (listings, photos, messages, etc.).
                  By posting content, you grant Ready Set Fly a worldwide, non-exclusive, royalty-free license to
                  use, reproduce, modify, display, and distribute your content in connection with operating and
                  promoting the Platform.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">8.2 Our Content</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  The Platform and all content, features, and functionality (including but not limited to design,
                  text, graphics, logos, and software) are owned by Ready Set Fly and are protected by copyright,
                  trademark, and other intellectual property laws.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">8.3 Copyright Infringement</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We respect intellectual property rights. If you believe your copyright has been infringed, please
                  contact us at{" "}
                  <a href="mailto:legal@readysetfly.us" className="text-[#9ec0ff] hover:underline">legal@readysetfly.us</a>{" "}
                  with details of the alleged infringement.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">9. Disclaimers and Limitation of Liability</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">9.1 Platform Provided &ldquo;As Is&rdquo;</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  THE PLATFORM IS PROVIDED ON AN &ldquo;AS IS&rdquo; AND &ldquo;AS AVAILABLE&rdquo; BASIS WITHOUT WARRANTIES OF ANY KIND,
                  EITHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY,
                  FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">9.2 No Guarantee of Service</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We do not guarantee that the Platform will be uninterrupted, secure, or error-free. We do not
                  guarantee the accuracy, completeness, or reliability of any content on the Platform.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">9.3 Third-Party Transactions</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Ready Set Fly is not a party to any rental agreements or marketplace transactions between users.
                  We do not verify the accuracy of listings, the qualifications of users, or the airworthiness of
                  aircraft. You are solely responsible for evaluating and verifying all aspects of any transaction
                  you enter into through the Platform.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">9.4 Aviation Risks</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Aviation involves inherent risks. Ready Set Fly is not responsible for any accidents, injuries,
                  damages, or losses resulting from aircraft rentals or operations. You assume all risks associated
                  with aviation activities.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">9.5 Limitation of Liability</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  TO THE MAXIMUM EXTENT PERMITTED BY LAW, READY SET FLY, ITS OFFICERS, DIRECTORS, EMPLOYEES, AND
                  AGENTS SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE
                  DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR
                  RELATED TO YOUR USE OF THE PLATFORM, EVEN IF WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS EXCEED THE GREATER OF $100 OR THE
                  AMOUNT YOU PAID TO US IN FEES IN THE 12 MONTHS PRECEDING THE CLAIM.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">10. Indemnification</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You agree to indemnify, defend, and hold harmless Ready Set Fly, its officers, directors, employees,
                  and agents from and against any claims, liabilities, damages, losses, and expenses (including
                  reasonable attorneys&apos; fees) arising out of or related to:
                </p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Your use of the Platform",
                    "Your violation of these Terms",
                    "Your violation of any law or regulation",
                    "Your violation of the rights of any third party",
                    "Any content you post on the Platform",
                    "Any aircraft rental or marketplace transaction you enter into",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">11. Dispute Resolution</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">11.1 Informal Resolution</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  If you have a dispute with Ready Set Fly, you agree to first contact us at{" "}
                  <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">support@readysetfly.us</a>{" "}
                  to attempt to resolve the dispute informally.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">11.2 Arbitration</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Any dispute that cannot be resolved informally shall be resolved by binding arbitration in accordance
                  with the rules of the American Arbitration Association. The arbitration shall take place in Texas.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">11.3 Class Action Waiver</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You agree that any arbitration or proceeding shall be limited to the dispute between you and Ready
                  Set Fly individually. You waive the right to participate in any class action or class-wide arbitration.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">11.4 Governing Law</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  These Terms shall be governed by and construed in accordance with the laws of the State of Texas, without
                  regard to its conflict of law provisions.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">12. Account Termination</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">12.1 Termination by You</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You may delete your account at any time by visiting your account settings or by contacting us at{" "}
                  <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">support@readysetfly.us</a>.
                  You can also submit a deletion request at{" "}
                  <a href="/delete-account" className="text-[#9ec0ff] hover:underline">readysetfly.us/delete-account</a>.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">12.2 Termination by Us</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We reserve the right to suspend or terminate your account at any time, with or without notice, for:
                </p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Violation of these Terms",
                    "Fraudulent, deceptive, or illegal activity",
                    "Failure to verify your identity when requested",
                    "Outstanding payment obligations",
                    "Any reason at our sole discretion",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">12.3 Effect of Termination</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Upon termination, your right to use the Platform will immediately cease. We may delete your account
                  data in accordance with our Privacy Policy. Outstanding payment obligations will survive termination.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">13. Modifications to Terms</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We reserve the right to modify these Terms at any time. We will notify you of material changes by:
                </p>
                <ul className="mt-3 space-y-2 pl-5">
                  {[
                    "Posting the updated Terms on this page",
                    'Updating the "Last Updated" date',
                    "Sending you an email notification",
                  ].map((item) => (
                    <li key={item} className="flex gap-2 text-sm leading-relaxed text-[#E8EDF4]">
                      <span className="mt-0.5 shrink-0 text-[#9ec0ff]">›</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 leading-relaxed text-[#E8EDF4]">
                  Your continued use of the Platform after the effective date of the revised Terms constitutes your
                  acceptance of the changes. If you do not agree to the revised Terms, you must stop using the Platform.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">14. General Provisions</h2>

                <h3 className="mb-2 mt-5 text-lg font-semibold text-[#F1F5FA]">14.1 Entire Agreement</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  These Terms, together with our Privacy Policy, constitute the entire agreement between you and
                  Ready Set Fly regarding the Platform.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">14.2 Severability</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  If any provision of these Terms is found to be invalid or unenforceable, the remaining provisions
                  will remain in full force and effect.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">14.3 Waiver</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  Our failure to enforce any right or provision of these Terms will not be deemed a waiver of such
                  right or provision.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">14.4 Assignment</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  You may not assign or transfer these Terms or your account without our prior written consent. We
                  may assign these Terms without restriction.
                </p>

                <h3 className="mb-2 mt-7 text-lg font-semibold text-[#F1F5FA]">14.5 Force Majeure</h3>
                <p className="leading-relaxed text-[#E8EDF4]">
                  We shall not be liable for any failure or delay in performance due to circumstances beyond our
                  reasonable control, including but not limited to acts of God, war, terrorism, natural disasters,
                  or government actions.
                </p>
              </section>

              <div className="rsf-metal-divider" />

              <section className="py-8">
                <h2 className="mb-3 text-xl font-semibold text-[#9ec0ff]">15. Contact Information</h2>
                <p className="leading-relaxed text-[#E8EDF4]">
                  If you have any questions about these Terms of Service, please contact us:
                </p>
                <div className="rsf-metal-subpanel mt-4 rounded-[1rem] p-5">
                  <p className="text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Email:</span>{" "}
                    <a href="mailto:legal@readysetfly.us" className="text-[#9ec0ff] hover:underline">legal@readysetfly.us</a>
                  </p>
                  <p className="mt-2 text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Support:</span>{" "}
                    <a href="mailto:support@readysetfly.us" className="text-[#9ec0ff] hover:underline">support@readysetfly.us</a>
                  </p>
                  <p className="mt-2 text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Website:</span>{" "}
                    <a href="https://readysetfly.us" className="text-[#9ec0ff] hover:underline">readysetfly.us</a>
                  </p>
                  <p className="mt-2 text-sm text-[#E8EDF4]">
                    <span className="font-semibold text-[#F1F5FA]">Mail:</span>{" "}
                    <span className="text-[#91a8c3]">Ready Set Fly, LLC (Address to be provided)</span>
                  </p>
                </div>
              </section>

              <div className="rsf-metal-divider" />

              <div className="rsf-metal-subpanel rounded-[1rem] p-5">
                <p className="text-sm leading-relaxed text-[#91a8c3]">
                  <strong className="text-[#F1F5FA]">Important Notice:</strong> These Terms of Service contain important information about your
                  legal rights and obligations, including limitations on liability and dispute resolution provisions.
                  Please read them carefully. By using the Platform, you acknowledge that you have read, understood,
                  and agree to be bound by these Terms.
                </p>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
