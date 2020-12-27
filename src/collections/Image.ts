import firebase from "firebase/app";
import "firebase/firestore";
import "firebase/storage";

import store from "@/store";
import { getName } from "@/scripts/helper";

export const DEFAULT_MAP_IMAGE = "3xAeZFAnozZsODuCs9XC";
export const DEFAULT_CHARACTER_IMAGE = "wG5tOfKAW3trnsApUNRy";

async function validateImageUrl(url: string) {
  return await new Promise(resolve => {
    const $img = new Image();
    $img.onload = () => resolve(true);
    $img.onerror = () => resolve(false);
    $img.src = url;
  });
}

export class FSImage {
  static unsubscribeMap = new Map();

  static Whose(id: string) {
    const owner = getName("image", id);
    return getName("user", owner);
  }

  static async GetById({ id }: { id: string }) {
    console.log("Image.GetById", id); // @DELETEME
    if (!id) {
      return null;
    }
    const db = firebase.firestore();
    const docRef = await db
      .collection("image")
      .doc(id)
      .get();
    if (!docRef.exists) {
      return null;
    }
    const image = docRef.data();

    if (!image) {
      throw new Error(`image does not exist: ${id}`);
    }

    /* urlが消費期限切れなら更新 */
    const url = image.url;
    const urlIsOk = await validateImageUrl(url);
    if (!urlIsOk) {
      const path = image.path;
      image.url = await FSImage.RenewImageUrl(path, id);
    }

    return { id, ...image };
  }

  static async SafeReloadUrl(id: string) {
    const image = store.getters["image/info"].find(
      (img: { id: string; url: string; path: string }) => img.id === id
    );
    if (!image) {
      console.warn(`image not found: ${id}`);
      return false;
    }
    const { url, path } = image;
    const urlIsOk = await validateImageUrl(url);
    if (!urlIsOk) {
      image.url = await FSImage.RenewImageUrl(path, id);
    }
  }

  static async RenewImageUrl(path: string, id: string) {
    console.log("renew image url");
    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child(path);
    const url = await imageRef.getDownloadURL();

    const db = firebase.firestore();
    const docRef = db.collection("image").doc(id);
    await docRef.update({ url });
    return url;
  }

  static async GetImageMetadata(
    file: File
  ): Promise<{ width: Number; height: Number }> {
    const url: string = URL.createObjectURL(file);

    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => {
        const { width, height } = image;
        resolve({ width, height });
      };
      image.onerror = e => {
        reject(e);
      };
      image.src = url;
    });
  }

  static async Create(file?: File | null) {
    if (!(file instanceof File)) {
      throw new Error(`argument must be instance of File()`);
    }

    /* 画像ファイル取得 */
    const { width, height } = await FSImage.GetImageMetadata(file);

    /* 画像ファイル情報 */
    const name = file.name;
    const size = file.size;
    const contentType = file.type;

    /* owner, roomId */
    const user = store.getters["auth/user"];
    const userId = user.id;

    const room = store.getters["room/info"];
    const roomId = room.id;

    /* fireStorage.path */
    const path = `${userId}/images/${name}`;

    const storageRef = firebase.storage().ref();
    const imageRef = storageRef.child(path);

    const metadata = {
      name,
      size,
      contentType
    };
    const url = await new Promise((resolve, reject) => {
      /* upload */
      const uploadTask = imageRef.put(file, metadata);
      uploadTask.on(
        "state_changed",
        snapshot => {
          /* progress observer */
          console.log(`uploading ${name},`, snapshot.state); // @DELETEME
        },
        e => {
          /* on error */
          reject(e);
        },
        async () => {
          /* on complete */
          const url = await uploadTask.snapshot.ref.getDownloadURL();
          console.log("uploading done: ", name); // @DELETEME
          resolve(url);
        }
      );
    });

    const image = {
      path,
      url,
      tags: [],
      owner: userId,
      room: roomId,
      hidden: false,
      width,
      height
    };
    const db = firebase.firestore();
    const imageDocRef = await db.collection("image").add(image);
    const id = imageDocRef.id;
    console.log(`+ register done. "${name}" complete!`); // @DELETEME

    return { id, ...image };
  }

  static async Update(id: string, criteria: object) {
    const db = firebase.firestore();
    const doc = db.collection("image").doc(id);
    return await doc.update(criteria);
  }

  static SetListener(roomId: string) {
    console.log("Image.SetListener", roomId); // @DELETEME

    const { unsubscribeMap } = FSImage;
    if (unsubscribeMap.has(roomId)) {
      FSImage.RemoveListener(roomId);
    }

    const db = firebase.firestore();
    const docsRef = db.collection("image").where("room", "==", roomId);

    const unsubscribe = docsRef.onSnapshot(querySnapshot => {
      const images: any[] = [];
      querySnapshot.forEach(doc => {
        const image = doc.data();
        image.id = doc.id;
        images.push(image);
      });
      store.dispatch("image/setImages", { images });
    });
    const listener = { roomId, unsubscribe };
    unsubscribeMap.set(roomId, listener);
  }

  static RemoveListener(roomId: string) {
    const { unsubscribeMap } = FSImage;
    if (!unsubscribeMap.has(roomId)) {
      console.log("no listener found: ", roomId); // @DELETEME
      return false;
    }
    const listener = unsubscribeMap.get(roomId);
    listener.unsubscribe();

    unsubscribeMap.delete(roomId);
  }
}
