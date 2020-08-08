import store from "@/store";
import firebase from "firebase/app";
import "firebase/auth";
import Vue from "vue";
import Room from "@/components/views/Room";
import RoomCreate from "@/components/views/RoomCreate";
import TermsOfService from "@/components/views/TermsOfService";
import PrivacyPolicy from "@/components/views/PrivacyPolicy";
import Router from "vue-router";

Vue.use(Router);

const router = new Router({
  mode: "history",
  routes: [
    {
      path: "/",
      component: RoomCreate
    },
    {
      path: "/r",
      component: Room
    },
    {
      path: "/terms-of-service",
      component: TermsOfService
    },
    {
      path: "/privacy-policy",
      component: PrivacyPolicy
    }
  ]
});

router.beforeEach((to, from, next) => {
  const { currentUser } = firebase.auth();
  if (currentUser) {
    store.dispatch("auth/logIn");
  }
  next();
});

export default router;