import LegalPage, { H2, P, Ul } from '../../components/legal/LegalPage'

export default function TermsOfUse() {
  return (
    <LegalPage title="Terms of Use" updated="1st September 2026">
      <P>
        Welcome to HHF CareConnect ("the Platform," "we," "us," or "our"), operated by Hossanah Help
        Foundation ("HHF," "the Foundation"), a non-governmental organization incorporated in Nigeria
        under the Corporate Affairs Commission (Incorporated Trustees, Registration No. CAC/IT/NO
        130297). These Terms of Use ("Terms") govern your access to and use of the Platform, available
        at chat.hhfoundation.com.ng and admin.hhfoundation.com.ng.
      </P>
      <P>
        By accessing or using the Platform, you agree to be bound by these Terms. If you do not agree,
        please do not use the Platform.
      </P>

      <H2>1. Who Can Use This Platform</H2>
      <Ul>
        <li>The public chat is intended for individuals seeking support or information from HHF.</li>
        <li>If you are under 18, we encourage you to have a parent, guardian, or trusted adult present or aware when using this service. See our safeguarding commitments below.</li>
        <li>The staff/admin portal is restricted to authorized HHF staff and volunteers only. Unauthorized access attempts are strictly prohibited.</li>
      </Ul>

      <H2>2. The Services We Provide</H2>
      <P>Through HHF CareConnect, you may:</P>
      <Ul>
        <li>Start a conversation with HHF staff regarding support, inquiries, or assistance</li>
        <li>Book appointments with HHF staff</li>
        <li>Receive follow-up communication related to your inquiry or appointment</li>
      </Ul>
      <P>
        HHF CareConnect is a communication and coordination tool. It does not replace emergency
        services. If you are in immediate danger or crisis, please contact local emergency services or
        a crisis helpline directly.
      </P>

      <H2>3. Your Responsibilities</H2>
      <P>When using the Platform, you agree to:</P>
      <Ul>
        <li>Provide accurate information when starting a conversation or booking an appointment</li>
        <li>Use the Platform respectfully — abusive, threatening, or harassing behavior toward staff or other users will not be tolerated</li>
        <li>Not use the Platform for any unlawful purpose, or to transmit harmful, defamatory, or fraudulent content</li>
        <li>Not attempt to gain unauthorized access to any part of the Platform, including staff/admin areas</li>
      </Ul>

      <H2>4. Staff and Volunteer Accounts</H2>
      <P>If you are issued a staff or volunteer account:</P>
      <Ul>
        <li>You are responsible for maintaining the confidentiality of your login credentials</li>
        <li>You agree to use client/visitor information only for the purpose of providing support through HHF, and in accordance with our Privacy Policy</li>
        <li>Misuse of client data, including unauthorized sharing or access, may result in immediate termination of your account and, where applicable, further action</li>
      </Ul>

      <H2>5. No Guarantee of Availability</H2>
      <P>
        We aim to keep HHF CareConnect available and responsive, but we do not guarantee uninterrupted
        access. The Platform may be unavailable at times due to maintenance, technical issues, or
        circumstances beyond our control.
      </P>

      <H2>6. Limitation of Liability</H2>
      <P>To the fullest extent permitted by Nigerian law:</P>
      <Ul>
        <li>HHF CareConnect is provided "as is." We do not guarantee that the Platform will be error-free or meet every need.</li>
        <li>HHF and its staff/volunteers shall not be held liable for indirect, incidental, or consequential damages arising from your use of the Platform.</li>
        <li>Nothing in these Terms limits any liability that cannot be excluded under Nigerian law.</li>
      </Ul>

      <H2>7. Data and Privacy</H2>
      <P>
        Your use of the Platform is also governed by our{' '}
        <a href="/privacy" className="text-hhf-blue underline">Privacy Policy</a>, which explains how we
        collect, use, and protect your information in accordance with the Nigeria Data Protection Act
        (NDPA) 2023.
      </P>

      <H2>8. Changes to These Terms</H2>
      <P>
        We may update these Terms from time to time. Continued use of the Platform after changes are
        posted constitutes acceptance of the revised Terms. We encourage you to review this page
        periodically.
      </P>

      <H2>9. Termination</H2>
      <P>
        We reserve the right to suspend or terminate access to the Platform for any user (visitor,
        staff, or volunteer) who violates these Terms.
      </P>

      <H2>10. Governing Law</H2>
      <P>
        These Terms are governed by the laws of the Federal Republic of Nigeria. Any disputes arising
        from your use of the Platform shall be subject to the jurisdiction of Nigerian courts.
      </P>

      <H2>11. Contact Us</H2>
      <P>If you have questions about these Terms, please contact us at:</P>
      <P>
        Email: info@hhfoundation.com.ng<br />
        Phone: +234 703 312 3616<br />
        Address: 4, Olumo Avenue, Alowonle Bus Stop, off Ajegunle Bus Stop, Lagos-Abeokuta Expressway, Lagos, Nigeria
      </P>
    </LegalPage>
  )
}
