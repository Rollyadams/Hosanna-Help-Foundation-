import LegalPage, { H2, P, Ul } from '../../components/legal/LegalPage'

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated="1st September 2026">
      <P>
        Hossanah Help Foundation ("HHF," "we," "us," or "our") operates HHF CareConnect
        (chat.hhfoundation.com.ng and admin.hhfoundation.com.ng). This Privacy Policy explains what
        personal data we collect, why we collect it, how we protect it, and your rights regarding your
        data, in accordance with the Nigeria Data Protection Act (NDPA) 2023.
      </P>
      <P>By using HHF CareConnect, you consent to the data practices described in this policy.</P>

      <H2>1. Who We Are</H2>
      <P>
        Hossanah Help Foundation is the data controller responsible for your personal data collected
        through HHF CareConnect.
      </P>
      <P>
        Email: info@hhfoundation.com.ng<br />
        Address: 4, Olumo Avenue, Alowonle Bus Stop, off Ajegunle Bus Stop, Lagos-Abeokuta Expressway, Lagos, Nigeria
      </P>

      <H2>2. What Information We Collect</H2>
      <P><strong>From visitors using the public chat:</strong></P>
      <Ul>
        <li>Name or nickname (optional, if you choose to provide it)</li>
        <li>The category and content of your inquiry/message</li>
        <li>Appointment details, if you book an appointment (preferred date/time, contact information)</li>
        <li>A guest password, if you set one to continue a conversation later (stored securely, not visible to staff)</li>
        <li>Technical information such as your approximate connection details, used only to keep the chat session working</li>
      </Ul>
      <P><strong>From registered clients, staff, and volunteers:</strong></P>
      <Ul>
        <li>Name, email address, and role</li>
        <li>Login activity and actions taken within the platform (for audit and accountability purposes)</li>
      </Ul>
      <P>We do not knowingly collect more information than necessary to provide support through the Platform.</P>

      <H2>3. Why We Collect Your Information (Legal Basis)</H2>
      <P>We process your personal data on the following legal bases under the NDPA:</P>
      <Ul>
        <li><strong>Consent</strong> — you provide information voluntarily when registering, starting a conversation, or booking an appointment</li>
        <li><strong>Legitimate interest</strong> — to enable HHF staff to respond to your inquiry, manage appointments, and improve our support services</li>
        <li><strong>Legal obligation</strong> — where necessary to comply with applicable Nigerian law</li>
      </Ul>

      <H2>4. How We Use Your Information</H2>
      <P>We use the information you provide to:</P>
      <Ul>
        <li>Respond to your inquiry or request for support</li>
        <li>Schedule and manage appointments</li>
        <li>Route your conversation to the appropriate staff member</li>
        <li>Maintain records for accountability, quality, and safeguarding purposes</li>
        <li>Improve our services</li>
      </Ul>
      <P>We do not sell your personal data. We do not use your information for advertising or marketing without your explicit consent.</P>

      <H2>5. Who Can Access Your Information</H2>
      <Ul>
        <li>Only authorized HHF staff and volunteers assigned to your case can view your conversation and appointment details.</li>
        <li>Staff access is logged for accountability (see our audit log system).</li>
        <li>We do not share your information with third parties, except where required by Nigerian law; with service providers who help us operate the Platform (e.g., our hosting and database provider, Supabase), who are contractually bound to protect your data; or in safeguarding situations where sharing information is necessary to protect someone from serious harm.</li>
      </Ul>

      <H2>6. Cookies and Local Storage</H2>
      <P>HHF CareConnect uses browser local storage (not third-party tracking cookies) to keep you logged into your session and to detect inactivity and manage session timeouts for security. We do not use advertising or analytics cookies that track you across other websites.</P>

      <H2>7. How Long We Keep Your Information</H2>
      <P>
        Conversation, account, and appointment records are retained for as long as necessary to provide
        ongoing support and for reasonable record-keeping purposes, or as required by law. You may
        request deletion of your data at any time (see Section 8). We will honor such requests unless we
        are legally required to retain certain records.
      </P>

      <H2>8. Your Rights Under the NDPA</H2>
      <P>You have the right to:</P>
      <Ul>
        <li>Know what personal data we hold about you</li>
        <li>Request a copy of your data</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data ("right to be forgotten"), subject to legal retention requirements — registered clients can delete their own account and data directly from their Profile page</li>
        <li>Withdraw consent at any time (this may affect our ability to continue assisting you)</li>
        <li>Lodge a complaint with the Nigeria Data Protection Commission (NDPC) if you believe your data has been mishandled</li>
      </Ul>
      <P>To exercise any of these rights, contact us at info@hhfoundation.com.ng.</P>

      <H2>9. How We Protect Your Information</H2>
      <P>We take reasonable technical and organizational measures to protect your data, including:</P>
      <Ul>
        <li>Encrypted password handling (passwords are never stored or viewable in plain text)</li>
        <li>Role-based access so only relevant staff can view sensitive information</li>
        <li>Audit logging of staff actions on the Platform</li>
      </Ul>
      <P>No system is completely secure, but we continuously work to safeguard your information.</P>

      <H2>10. Children's Privacy and Safeguarding</H2>
      <P>
        We understand that some individuals seeking support through HHF CareConnect may be minors. We
        handle any interactions involving minors with additional care, in line with our internal
        Safeguarding Policy. Where a minor discloses information suggesting risk of harm, our staff may
        take appropriate protective action, which may include limited information sharing necessary to
        ensure their safety.
      </P>

      <H2>11. Changes to This Policy</H2>
      <P>
        We may update this Privacy Policy from time to time. Material changes will be reflected with an
        updated "Last updated" date. Continued use of the Platform after changes are posted constitutes
        acceptance of the revised policy.
      </P>

      <H2>12. Contact Us</H2>
      <P>
        Email: info@hhfoundation.com.ng<br />
        Phone: +234 703 312 3616<br />
        Address: 4, Olumo Avenue, Alowonle Bus Stop, off Ajegunle Bus Stop, Lagos-Abeokuta Expressway, Lagos, Nigeria
      </P>
    </LegalPage>
  )
}
