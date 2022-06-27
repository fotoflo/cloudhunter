import type { GetServerSideProps, NextPage } from "next";
import { Session } from "next-auth";
import { getSession } from "next-auth/react";
import { useRouter } from "next/router";
import GoogleLoginButton from "components/GoogleLoginButton";
import { useEffect } from "react";
import { Container } from "react-bootstrap";

const LoginPage: NextPage<{}> = () => {
  return (
    <Container>
      Login:
      <GoogleLoginButton />
    </Container>
  );
};

export default LoginPage;

export const getServerSideProps: GetServerSideProps = async (context) => {
  const session = await getSession(context);

  if (session) {
    return {
      redirect: {
        permanent: false,
        destination: "/",
      },
    };
  }

  return {
    props: {},
  };
};
